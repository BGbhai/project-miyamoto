#!/usr/bin/env python3

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build


TZ = ZoneInfo("Asia/Kolkata")
SHEET_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADER = [
    "Date",
    "Week Start",
    "Day",
    "Session",
    "Plan",
    "Completed",
    "Effort",
    "Joints",
    "Notes",
    "Updated At",
]
DONE_STATES = {"done", "partial"}
WARNING_EFFORTS = {"hard"}
WARNING_JOINTS = {"tight", "irritated"}
GYM_KEYS = {"bridge", "lower", "upper", "athletic", "posterior", "athletic_posterior", "integration"}


@dataclass
class LogRow:
    row_number: int
    day_date: date
    week_start: date
    day_name: str
    session: str
    plan: str
    completed: str
    effort: str
    joints: str
    notes: str
    updated_at: str


@dataclass
class Feedback:
    scheduled_so_far: int
    completed_so_far: int
    missed_so_far: int
    hard_count: int
    joint_warning_count: int
    completed_gym_keys: list[str]
    missed_gym_keys: list[str]

    @property
    def completion_rate(self) -> float:
        if self.scheduled_so_far == 0:
            return 0.0
        return self.completed_so_far / self.scheduled_so_far


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Update Project Miyamoto cloud workout plan.")
    parser.add_argument("--mode", choices=["weekly", "nightly"], required=True)
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--sheet-id", default=os.getenv("GYM_SHEET_ID", ""))
    parser.add_argument("--sheet-tab", default=os.getenv("GYM_SHEET_TAB", "Session Log"))
    parser.add_argument("--credentials-env", default="GYM_GOOGLE_SERVICE_ACCOUNT_JSON")
    parser.add_argument("--today")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def parse_iso_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def iso_day(value: date) -> str:
    return value.isoformat()


def pretty_day(value: date) -> str:
    return value.strftime("%b ") + str(value.day)


def pretty_range(week_start: date) -> str:
    week_end = week_start + timedelta(days=6)
    return f"{week_start.strftime('%b')} {week_start.day} - {week_end.strftime('%b')} {week_end.day}, {week_end.year}"


def monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def next_monday(value: date) -> date:
    return monday_of(value) + timedelta(days=7)


def now_ist(today_override: str | None) -> datetime:
    if today_override:
        naive = datetime.strptime(today_override, "%Y-%m-%d")
        return datetime.combine(naive.date(), datetime.now(TZ).time(), TZ)
    return datetime.now(TZ)


def updated_label(now: datetime) -> str:
    return f"{now.strftime('%b')} {now.day}, {now.year} at {now.strftime('%I').lstrip('0') or '0'}:{now.strftime('%M')} {now.strftime('%p')} IST"


def updated_stamp(now: datetime) -> str:
    return now.strftime("%Y-%m-%d %H:%M IST")


def credentials_from_env(env_name: str) -> Credentials:
    raw = os.getenv(env_name)
    if not raw:
        raise RuntimeError(
            f"Missing required env var {env_name}. Add the Google service account JSON as a GitHub secret."
        )
    info = json.loads(raw)
    return Credentials.from_service_account_info(info, scopes=SHEET_SCOPES)


def sheets_service(credentials: Credentials):
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def fetch_sheet(service, sheet_id: str, sheet_tab: str) -> tuple[list[LogRow], int]:
    spreadsheet = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    sheet_id_numeric = None
    for sheet in spreadsheet.get("sheets", []):
        props = sheet.get("properties", {})
        if props.get("title") == sheet_tab:
            sheet_id_numeric = props.get("sheetId")
            break
    if sheet_id_numeric is None:
        raise RuntimeError(f"Sheet tab '{sheet_tab}' not found in spreadsheet {sheet_id}.")

    response = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=f"'{sheet_tab}'!A:J")
        .execute()
    )
    values = response.get("values", [])
    if not values:
        return [], sheet_id_numeric

    rows: list[LogRow] = []
    for index, raw in enumerate(values[1:], start=2):
        cells = list(raw) + [""] * (10 - len(raw))
        if not cells[0] or not cells[1]:
            continue
        rows.append(
            LogRow(
                row_number=index,
                day_date=parse_iso_day(cells[0]),
                week_start=parse_iso_day(cells[1]),
                day_name=cells[2],
                session=cells[3],
                plan=cells[4],
                completed=cells[5].strip().lower(),
                effort=cells[6].strip().lower(),
                joints=cells[7].strip().lower(),
                notes=cells[8],
                updated_at=cells[9],
            )
        )
    return rows, sheet_id_numeric


def load_week_json(repo_root: Path) -> dict[str, Any]:
    path = repo_root / "gym-web" / "data" / "current-week.json"
    return json.loads(path.read_text())


def save_week_json(repo_root: Path, payload: dict[str, Any]) -> None:
    path = repo_root / "gym-web" / "data" / "current-week.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")


def feedback_for_week(rows: list[LogRow], cutoff: date) -> Feedback:
    scheduled = 0
    completed = 0
    missed = 0
    hard_count = 0
    joint_warning_count = 0
    completed_gym_keys: list[str] = []
    missed_gym_keys: list[str] = []

    for row in rows:
        if row.day_date > cutoff:
            continue
        scheduled += 1
        key = classify_session_plan(row.plan, row.session)
        if row.completed in DONE_STATES:
            completed += 1
            if row.effort in WARNING_EFFORTS:
                hard_count += 1
            if row.joints in WARNING_JOINTS:
                joint_warning_count += 1
            if key in GYM_KEYS:
                completed_gym_keys.append(key)
        else:
            missed += 1
            if key in GYM_KEYS:
                missed_gym_keys.append(key)

    return Feedback(
        scheduled_so_far=scheduled,
        completed_so_far=completed,
        missed_so_far=missed,
        hard_count=hard_count,
        joint_warning_count=joint_warning_count,
        completed_gym_keys=completed_gym_keys,
        missed_gym_keys=missed_gym_keys,
    )


def base_intensity(existing: dict[str, Any]) -> float:
    try:
        return float(existing.get("week", {}).get("targetIntensity", 0.6))
    except Exception:
        return 0.6


def choose_weekly_intensity(existing: dict[str, Any], feedback: Feedback) -> float:
    current = base_intensity(existing)
    if feedback.joint_warning_count > 0 or feedback.hard_count >= 2 or feedback.completion_rate < 0.45:
        return max(0.5, round(current - 0.05, 2))
    if feedback.completion_rate >= 0.8 and feedback.hard_count == 0 and feedback.joint_warning_count == 0:
        return min(0.7, round(current + 0.05, 2))
    return current


def monday_reset_needed(feedback: Feedback) -> bool:
    return feedback.joint_warning_count > 0 or feedback.hard_count >= 2 or feedback.completion_rate < 0.45


def week_header(
    existing: dict[str, Any],
    week_start: date,
    now: datetime,
    focus: str,
    rhythm: str,
    automation: str,
    intensity: float,
) -> dict[str, Any]:
    week = copy.deepcopy(existing["week"])
    week["label"] = pretty_range(week_start)
    week["focus"] = focus
    week["rhythm"] = rhythm
    week["automation"] = automation
    week["updatedAtLabel"] = updated_label(now)
    week["targetIntensity"] = intensity
    return week


def base_payload(existing: dict[str, Any], week: dict[str, Any], days: list[dict[str, Any]]) -> dict[str, Any]:
    payload = copy.deepcopy(existing)
    payload["brand"] = copy.deepcopy(existing["brand"])
    payload["targets"] = copy.deepcopy(existing["targets"])
    payload["tracking"] = copy.deepcopy(existing["tracking"])
    payload["skillTracks"] = copy.deepcopy(existing["skillTracks"])
    payload["alternatives"] = copy.deepcopy(existing["alternatives"])
    payload["sources"] = copy.deepcopy(existing["sources"])
    payload["week"] = week
    payload["days"] = days
    return payload


def day_name(value: date) -> str:
    return value.strftime("%A")


def canonical_week_days(week_start: date, intensity: float, monday_reset: bool) -> list[dict[str, Any]]:
    days = [
        build_run_day(week_start, intensity, reset=monday_reset),
        build_lower_day(week_start + timedelta(days=1), intensity),
        build_upper_day(week_start + timedelta(days=2), intensity),
        build_athletic_day(week_start + timedelta(days=3), intensity),
        build_posterior_day(week_start + timedelta(days=4), intensity),
        build_integration_day(week_start + timedelta(days=5), intensity),
        build_rest_day(week_start + timedelta(days=6)),
    ]
    return days


def nightly_no_change(feedback: Feedback) -> bool:
    return (
        feedback.missed_so_far == 0
        and feedback.hard_count == 0
        and feedback.joint_warning_count == 0
        and feedback.scheduled_so_far > 0
    )


def plan_key_from_day(day: dict[str, Any]) -> str:
    if "planKey" in day:
        return day["planKey"]
    title = day.get("title", "").lower()
    if "re-entry full body" in title:
        return "bridge"
    if "lower" in title and "pistol" in title:
        return "lower"
    if "upper" in title and "explosive pull" in title:
        return "upper"
    if "upper" in title and "handstand" in title:
        return "upper"
    if "athletic posterior" in title:
        return "athletic_posterior"
    if "posterior chain" in title:
        return "posterior"
    if "athletic full body" in title:
        return "athletic"
    if "integrated" in title or "integration" in title:
        return "integration"
    if "run" in title or "reset" in title:
        return "run"
    return "integration"


def classify_session_plan(plan: str, session: str) -> str:
    text = f"{plan} {session}".lower()
    if "re-entry full body" in text:
        return "bridge"
    if "lower strength" in text or "pistol skill" in text:
        return "lower"
    if "upper strength" in text or "handstand line" in text or "explosive pull" in text:
        return "upper"
    if "athletic posterior" in text:
        return "athletic_posterior"
    if "posterior chain" in text:
        return "posterior"
    if "athletic full body" in text:
        return "athletic"
    if "integrated skill" in text or "integration" in text:
        return "integration"
    if "run" in text:
        return "run"
    if "mobility" in text:
        return "mobility"
    return "other"


def combine_tail(keys: list[str]) -> str:
    keyset = set(keys)
    if "athletic" in keyset or "posterior" in keyset or "athletic_posterior" in keyset:
        return "athletic_posterior"
    if "lower" in keyset and "upper" in keyset:
        return "integration"
    return keys[-1]


def squeeze_queue(queue: list[str], slots: int) -> list[str]:
    filtered = [key for key in queue if key != "run"]
    if len(filtered) <= slots:
        return filtered
    head = filtered[: max(0, slots - 1)]
    tail = filtered[max(0, slots - 1) :]
    if slots <= 0:
        return []
    return head + [combine_tail(tail)]


def build_day_from_key(key: str, value: date, intensity: float) -> dict[str, Any]:
    if key == "bridge":
        return build_bridge_day(value, intensity)
    if key == "lower":
        return build_lower_day(value, intensity)
    if key == "upper":
        return build_upper_day(value, intensity)
    if key == "athletic":
        return build_athletic_day(value, intensity)
    if key == "posterior":
        return build_posterior_day(value, intensity)
    if key == "athletic_posterior":
        return build_athletic_posterior_day(value, intensity)
    return build_integration_day(value, intensity)


def adjust_current_week(existing: dict[str, Any], rows: list[LogRow], today: date, now: datetime) -> tuple[dict[str, Any], bool]:
    feedback = feedback_for_week(rows, today)
    if nightly_no_change(feedback):
        return existing, False

    updated = copy.deepcopy(existing)
    intensity = base_intensity(existing)
    future_days = [day for day in updated["days"] if parse_iso_day(day["date"]) > today and day["slug"] != "sunday"]
    future_evening_days = [day for day in future_days if day["slug"] != "sunday"]
    if not future_evening_days:
        return updated, False

    queued_keys = feedback.missed_gym_keys + [plan_key_from_day(day) for day in future_evening_days]
    if not feedback.completed_gym_keys:
        queued_keys = ["bridge"] + queued_keys
    queued_keys = squeeze_queue(queued_keys, len(future_evening_days))

    for day, key in zip(future_evening_days, queued_keys):
        new_day = build_day_from_key(key, parse_iso_day(day["date"]), intensity)
        day.clear()
        day.update(new_day)

    updated["week"]["focus"] = (
        f"Nightly adjustment: {feedback.missed_so_far} missed session(s) or recovery flags were logged, "
        "so the remaining week was narrowed instead of forcing catch-up debt."
    )
    updated["week"]["rhythm"] = (
        "Morning mobility stays in place. Remaining evening gym sessions are reordered only as much as needed."
    )
    updated["week"]["automation"] = "Nightly adjuster Mon-Sat at 10:00 PM, weekly reset Sunday at 9:00 PM"
    updated["week"]["updatedAtLabel"] = updated_label(now)
    return updated, updated != existing


def build_weekly_payload(existing: dict[str, Any], rows: list[LogRow], week_start: date, now: datetime) -> dict[str, Any]:
    prior_rows = [row for row in rows if row.week_start == monday_of(now.date())]
    feedback = feedback_for_week(prior_rows, now.date())
    intensity = choose_weekly_intensity(existing, feedback)
    monday_reset = monday_reset_needed(feedback)
    monday_copy = "reset walk + mobility" if monday_reset else "run-only ramp-in"
    focus = (
        f"Last week logged {feedback.completed_so_far}/{feedback.scheduled_so_far} completed sessions, "
        f"{feedback.missed_so_far} misses, {feedback.hard_count} hard efforts, and {feedback.joint_warning_count} joint warning signal(s). "
        "This next week keeps calisthenics skill, density, speed, mobility, and flexibility integrated while nudging load only if recovery earned it."
    )
    rhythm = (
        f"Monday stays {monday_copy}, Tuesday-Saturday keep morning mobility and evening gym, and Sunday remains full rest."
    )
    week = week_header(
        existing,
        week_start=week_start,
        now=now,
        focus=focus,
        rhythm=rhythm,
        automation="Nightly adjuster Mon-Sat at 10:00 PM, weekly reset Sunday at 9:00 PM",
        intensity=intensity,
    )
    days = canonical_week_days(week_start, intensity, monday_reset)
    return base_payload(existing, week, days)


def log_plan_rows(days: list[dict[str, Any]], week_start: date) -> list[list[str]]:
    rows: list[list[str]] = []
    for day in days:
        day_date = parse_iso_day(day["date"])
        if day["slug"] == "monday":
            rows.append(
                [
                    iso_day(day_date),
                    iso_day(week_start),
                    day["day"],
                    "Evening",
                    day.get("logPlanEvening", "Easy run 20-30 min + stretch"),
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
            continue
        if day["slug"] == "sunday":
            continue
        rows.append(
            [
                iso_day(day_date),
                iso_day(week_start),
                day["day"],
                "Morning",
                day.get("logPlanMorning", day["morning"]["label"].replace("Morning / ", "")),
                "",
                "",
                "",
                "",
                "",
            ]
        )
        rows.append(
            [
                iso_day(day_date),
                iso_day(week_start),
                day["day"],
                "Evening",
                day.get("logPlanEvening", day["evening"]["label"].replace("Evening / ", "")),
                "",
                "",
                "",
                "",
                "",
            ]
        )
    return rows


def ensure_row_validations(service, spreadsheet_id: str, sheet_id_numeric: int, start_row_zero: int, end_row_zero: int) -> None:
    requests = []
    for column, values in (
        (5, ["done", "partial", "skipped"]),
        (6, ["easy", "solid", "hard"]),
        (7, ["fine", "tight", "irritated"]),
    ):
        requests.append(
            {
                "setDataValidation": {
                    "range": {
                        "sheetId": sheet_id_numeric,
                        "startRowIndex": start_row_zero,
                        "endRowIndex": end_row_zero,
                        "startColumnIndex": column,
                        "endColumnIndex": column + 1,
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [{"userEnteredValue": value} for value in values],
                        },
                        "showCustomUi": True,
                        "strict": True,
                    },
                }
            }
        )
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests},
    ).execute()


def write_rows_for_week(
    service,
    spreadsheet_id: str,
    sheet_id_numeric: int,
    sheet_tab: str,
    existing_rows: list[LogRow],
    week_start: date,
    planned_rows: list[list[str]],
    mode: str,
    now: datetime,
) -> None:
    week_rows = [row for row in existing_rows if row.week_start == week_start]
    by_key = {(row.day_date, row.session): row for row in week_rows}

    if mode == "weekly":
        missing = []
        for planned in planned_rows:
            key = (parse_iso_day(planned[0]), planned[3])
            if key not in by_key:
                missing.append(planned)
        if not missing:
            return

        start_row = (existing_rows[-1].row_number if existing_rows else 1) + 1
        end_row = start_row + len(missing) - 1
        range_name = f"'{sheet_tab}'!A{start_row}:J{end_row}"
        body = {"values": [row[:9] + [updated_stamp(now)] for row in missing]}
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption="RAW",
            body=body,
        ).execute()
        ensure_row_validations(service, spreadsheet_id, sheet_id_numeric, start_row - 1, end_row)
        return

    for planned in planned_rows:
        key = (parse_iso_day(planned[0]), planned[3])
        row = by_key.get(key)
        if not row:
            continue
        if row.day_date <= now.date():
            continue
        range_name = f"'{sheet_tab}'!E{row.row_number}:J{row.row_number}"
        values = [[planned[4], row.completed, row.effort, row.joints, row.notes, updated_stamp(now)]]
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption="RAW",
            body={"values": values},
        ).execute()


def build_run_day(value: date, intensity: float, reset: bool) -> dict[str, Any]:
    if reset:
        return {
            "slug": "monday",
            "date": iso_day(value),
            "day": day_name(value),
            "planKey": "run",
            "title": "Reset walk + mobility",
            "summary": "Use Monday to come back to baseline. This is the lower-friction version of a ramp-in day when the prior week showed extra fatigue or inconsistency.",
            "status": "Reset day",
            "builds": ["Recovery", "Mobility", "Consistency"],
            "morning": {
                "label": "Morning / easy mobility",
                "bullets": [
                    "90/90 switches 2x8 per side",
                    "Open book 2x6 per side",
                    "Couch stretch 2x45s per side",
                    "Ankle rocks 2x12 per side",
                    "2 min slow breathing",
                ],
            },
            "skill": {
                "label": "Skill block / off",
                "copy": "No formal skill ladder today. Save your best quality for Tuesday onward.",
            },
            "bodyweight": "Skip the daily bodyweight block today unless you feel very fresh. This Monday exists to lower friction, not to add debt.",
            "note": "If your body feels flat, keep the walk and stretches only.",
            "evening": {
                "label": "Evening / walk + mobility",
                "bullets": [
                    "20-30 min brisk walk",
                    "Deep squat hold 2x30-45s",
                    "Hamstring stretch 2x30-45s",
                    "Doorway pec stretch 2x30-45s",
                ],
            },
            "swaps": ["Walk -> easy bike", "Mobility only", "No catch-up lifting"],
            "logPlanMorning": "Easy mobility flow",
            "logPlanEvening": "Reset walk 20-30 min + mobility",
        }

    return {
        "slug": "monday",
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "run",
        "title": "Run-only ramp-in",
        "summary": "Keep the first day easy. Restart rhythm without digging a fatigue hole.",
        "status": "Starter day",
        "builds": ["Aerobic reset", "Running rhythm", "Recovery"],
        "morning": {
            "label": "Morning / off",
            "copy": "No lifting today. Save your legs for an easy evening run.",
        },
        "skill": {
            "label": "Skill block / off",
            "copy": "No formal calisthenics skill work today. The win is showing up and starting the week with control.",
        },
        "bodyweight": "Skip the daily bodyweight block today.",
        "note": "If the run feels rough, turn it into a run-walk.",
        "evening": {
            "label": "Evening / easy run",
            "bullets": [
                "5 min walk",
                "20-30 min easy run",
                "5 min walk",
                "Calf stretch, couch stretch, hamstring stretch",
            ],
        },
        "swaps": ["Run -> incline walk", "Run -> bike flush", "Stretch only if needed"],
        "logPlanEvening": "Easy run 20-30 min + stretch",
    }


def build_lower_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "lower",
        "title": "Lower strength + pistol skill / evening gym",
        "summary": "Train hard enough to matter, but keep the bar speed clean and stay recoverable for the rest of the week.",
        "builds": ["Muscle density", "Leg control", "Ankle mobility"],
        "morning": {
            "label": "Morning / lower mobility",
            "bullets": [
                "90/90 switches 2x8 per side",
                "Couch stretch 2x45-60s per side",
                "Ankle rocks 2x12 per side",
                "Deep squat hold 2x30-45s",
                "Elephant walks 2x10",
            ],
        },
        "skill": {
            "label": "Skill block / pistol pattern",
            "copy": "Keep the single-leg work honest, balanced, and controlled instead of turning it into extra fatigue.",
            "bullets": [
                "Assisted pistol to box 3x4 per side",
                "Split-squat bottom hold 2x20s per side",
                "Cossack squat 2x6 per side",
            ],
        },
        "bodyweight": f"Run the normal daily target block after the evening skill work at {int(intensity * 100)}% of your current technical max.",
        "note": "Leave 1-2 reps in reserve on the squat and hinge today.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Broad jump 3x3",
                "Back squat or front squat 3x5",
                "Romanian deadlift 3x6-8",
                "Walking lunge 2x8 per leg",
                "Hanging leg raise 3x10-12",
            ],
        },
        "swaps": [
            "Back/front squat -> hack squat, leg press, goblet squat",
            "RDL -> DB RDL or 45-degree back extension",
            "Walking lunge -> reverse lunge or step-up",
        ],
        "logPlanMorning": "Lower mobility",
        "logPlanEvening": "Lower strength + pistol skill + daily calisthenics",
    }


def build_upper_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "upper",
        "title": "Upper strength + handstand line / evening gym",
        "summary": "Build upper-body density and clean shoulder stacking. Keep the reps crisp enough that skill quality stays visible.",
        "builds": ["Upper density", "Push balance", "Shoulder control"],
        "morning": {
            "label": "Morning / upper mobility reset",
            "bullets": [
                "T-spine rotations 2x8 per side",
                "Doorway pec stretch 2x45s per side",
                "Wall lat stretch 2x45s per side",
                "Wrist extension stretch 2x30s per side",
                "Box breathing 2 min",
            ],
        },
        "skill": {
            "label": "Skill block / handstand line",
            "copy": "Treat this as shoulder stacking practice, not circus work. Make every rep look clean.",
            "bullets": [
                "Wall-facing handstand hold 3x20-25s",
                "Box pike press 2x5",
                "Scap push-up 2x10",
            ],
        },
        "bodyweight": f"Run the normal daily target block after the evening skill work at {int(intensity * 100)}% of your current technical max.",
        "note": "Cut one accessory before pressing quality gets sloppy.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Med-ball chest throw 3x3",
                "Incline press 3x6",
                "Chest-supported row 3x8",
                "Landmine press 2x8 per side",
                "Face pull 2x15",
            ],
        },
        "swaps": [
            "Incline press -> DB bench or machine chest press",
            "Chest-supported row -> cable row or 1-arm DB row",
            "Landmine press -> high-incline DB press",
        ],
        "logPlanMorning": "Upper mobility reset",
        "logPlanEvening": "Upper strength + handstand line + daily calisthenics",
    }


def build_athletic_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "athletic",
        "title": "Athletic full body + explosive pull / evening gym",
        "summary": "Move crisply, keep the intervals honest, and build pulling speed without letting the reps get sloppy.",
        "builds": ["Speed", "Agility", "Pulling skill"],
        "morning": {
            "label": "Morning / athletic prep mobility",
            "bullets": [
                "5 min easy nasal breathing",
                "Cat-camel x8",
                "Open book 2x6 per side",
                "Couch stretch 60s per side",
                "Supine twist 45s per side",
            ],
        },
        "skill": {
            "label": "Skill block / explosive pull",
            "copy": "Build speed and scap control first. The goal is faster, cleaner pull-ups, not random fatigue.",
            "bullets": [
                "Scap pull-up 2x6",
                "Chest-to-bar intent pull-up 3x3",
                "False-grip or active hang 3x15-20s",
            ],
        },
        "bodyweight": f"Run the normal daily target block after the evening skill work at {int(intensity * 100)}% of your current technical max.",
        "note": "Cut interval volume before movement quality.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Line hops or jump rope 5 min",
                "Kettlebell swing 4x10",
                "Bulgarian split squat 3x8 per leg",
                "Push press 4x4",
                "Farmer carry 4x25m",
                "Bike or sled intervals 5 rounds",
            ],
        },
        "swaps": [
            "Line hops -> pogo jumps or jump rope",
            "KB swing -> med-ball slam or trap-bar jump",
            "Bike/sled intervals -> rower sprint or shuttle runs",
        ],
        "logPlanMorning": "Athletic prep mobility",
        "logPlanEvening": "Athletic full body + explosive pull + daily calisthenics",
    }


def build_posterior_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "posterior",
        "title": "Posterior chain + compression / evening gym",
        "summary": "Posterior power plus core control. Keep the heavy hinge crisp and let the compression work support your bigger skill ladders.",
        "builds": ["Posterior power", "Core compression", "Recovery management"],
        "morning": {
            "label": "Morning / posterior mobility",
            "bullets": [
                "90/90 switches 2x8 per side",
                "Hamstring or elephant walk 2x10",
                "Ankle rocks 2x12 per side",
                "Deep squat hold 2x30-45s",
                "2 min slow breathing",
            ],
        },
        "skill": {
            "label": "Skill block / compression",
            "copy": "Touch the core ladder directly so hanging work, L-sit work, and press strength keep moving forward together.",
            "bullets": [
                "Hollow body hold 3x20-30s",
                "Seated compression lift-off 3x8",
                "Hanging knee raise 2x8",
            ],
        },
        "bodyweight": f"Run the normal daily target block after the evening skill work at {int(intensity * 100)}% of your current technical max.",
        "note": "Heavy hinge first, then core work that still looks intentional.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Acceleration drills 6x10-20m",
                "Trap-bar deadlift 3x4-6",
                "Front-foot elevated split squat 3x8 per leg",
                "Hip thrust 3x8-10",
                "Lateral bounds 3x5 per side",
                "Copenhagen plank 3x20-30s",
            ],
        },
        "swaps": [
            "Acceleration drills -> incline treadmill sprint or sled sprint",
            "Trap-bar deadlift -> conventional deadlift, rack pull, heavy RDL",
            "Hip thrust -> glute bridge or cable pull-through",
        ],
        "logPlanMorning": "Posterior mobility + breathing reset",
        "logPlanEvening": "Posterior chain + compression + daily calisthenics",
    }


def build_integration_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "integration",
        "title": "Integrated density + mixed skill / evening gym",
        "summary": "Last lift of the week. Touch strength, skill, and movement quality without turning Saturday into a test.",
        "builds": ["Integration", "Movement quality", "Recovery management"],
        "morning": {
            "label": "Morning / long mobility + flexibility flow",
            "bullets": [
                "5 min easy nasal breathing",
                "90/90 switches 2x8 per side",
                "Open book 2x6 per side",
                "Couch stretch 60s per side",
                "Hamstring or elephant walk 2x10",
                "Deep squat hold 2x30-45s",
            ],
        },
        "skill": {
            "label": "Skill block / weekly integration",
            "copy": "Touch each ladder once more before the rest day without chasing a test rep.",
            "bullets": [
                "Wall-facing handstand hold 2x20s",
                "Hanging knee raise or tuck raise 2x8",
                "Assisted pistol 2x3 per side",
            ],
        },
        "bodyweight": f"Run the normal daily target block after the evening skill work at {int(intensity * 100)}% of your current technical max.",
        "note": "Stop cleanly so Sunday still feels like real recovery.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Goblet squat 3x8",
                "Neutral-grip DB press 3x8",
                "Chest-supported row 3x10",
                "Farmer carry 3x20m",
                "Sled push or bike intervals 4 rounds",
            ],
        },
        "swaps": [
            "Goblet squat -> leg press or hack squat",
            "Neutral-grip DB press -> machine chest press or weighted push-up",
            "Sled push -> bike or rower intervals",
        ],
        "logPlanMorning": "Long mobility + flexibility flow",
        "logPlanEvening": "Integrated density + mixed skill + daily calisthenics",
    }


def build_athletic_posterior_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "athletic_posterior",
        "title": "Athletic posterior chain + integration / evening gym",
        "summary": "Finish the shortened week with speed, posterior chain work, and one lighter touch on each skill ladder. You should finish trained, not trashed.",
        "builds": ["Posterior power", "Agility", "Integrated skill"],
        "morning": {
            "label": "Morning / long mobility + flexibility flow",
            "bullets": [
                "5 min easy nasal breathing",
                "90/90 switches 2x8 per side",
                "Open book 2x6 per side",
                "Couch stretch 60s per side",
                "Hamstring or elephant walk 2x10",
                "Deep squat hold 2x30-45s",
            ],
        },
        "skill": {
            "label": "Skill block / weekly integration",
            "copy": "Touch each ladder once more without turning the end of the week into a test.",
            "bullets": [
                "Wall-facing handstand hold 2x20s",
                "Hanging knee raise or tuck raise 2x8",
                "Assisted pistol 2x3 per side",
            ],
        },
        "bodyweight": f"Use the normal daily target block after the evening skill block at {int(intensity * 100)}% of your current technical max. Keep the reps clean and submaximal.",
        "note": "Saturday should still leave Sunday as a real rest day.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "Line hops or jump rope 5 min",
                "Trap-bar deadlift 3x4-6",
                "Kettlebell swing 3x10",
                "Bulgarian split squat 2x8 per leg",
                "Farmer carry 3x25m",
                "Lateral bounds 3x5 per side",
                "Copenhagen plank 2x20-30s",
            ],
        },
        "swaps": [
            "Trap-bar deadlift -> conventional deadlift, rack pull, heavy RDL",
            "Kettlebell swing -> med-ball slam or explosive DB hinge",
            "Line hops -> pogo jumps or jump rope",
        ],
        "logPlanMorning": "Long mobility + flexibility flow",
        "logPlanEvening": "Athletic posterior chain + integrated skill + daily calisthenics",
    }


def build_bridge_day(value: date, intensity: float) -> dict[str, Any]:
    return {
        "slug": value.strftime("%A").lower(),
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "bridge",
        "title": "Re-entry full body + handstand line / evening gym",
        "summary": "Use this as a bridge session when the week starts late. Touch the big patterns, wake up the shoulders and hips, and leave enough in the tank to train properly after it.",
        "status": "Reset day",
        "builds": ["Full-body density", "Push balance", "Re-entry control"],
        "morning": {
            "label": "Morning / re-entry mobility",
            "bullets": [
                "90/90 switches 2x8 per side",
                "T-spine rotations 2x8 per side",
                "Wrist extension stretch 2x30s per side",
                "Ankle rocks 2x12 per side",
                "2 min box breathing",
            ],
        },
        "skill": {
            "label": "Skill block / handstand line",
            "copy": "Keep this clean and technical. The goal is shoulder stacking and line awareness, not fatigue.",
            "bullets": [
                "Wall-facing handstand hold 3x20-25s",
                "Box pike press 2x5",
                "Scap push-up 2x10",
            ],
        },
        "bodyweight": f"Use about 70-80% of the usual daily targets after the evening skill block tonight. Keep everything clearly submaximal.",
        "note": "A clean moderate bridge session is better than forcing a fake hero day.",
        "evening": {
            "label": "Evening / gym",
            "bullets": [
                "10-12 min full-body warm-up with hips, T-spine, and wrists",
                "Med-ball chest throw 3x3",
                "Goblet squat or front squat 3x6",
                "Incline DB press 3x6",
                "Chest-supported row 3x8",
                "Romanian deadlift 2x8",
                "Farmer carry 3x20m",
            ],
        },
        "swaps": [
            "Goblet/front squat -> hack squat or leg press",
            "Incline DB press -> machine chest press or weighted push-up",
            "Chest-supported row -> cable row or 1-arm DB row",
        ],
        "logPlanMorning": "Re-entry mobility",
        "logPlanEvening": "Re-entry full body + handstand line + 70-80% daily calisthenics",
    }


def build_rest_day(value: date) -> dict[str, Any]:
    return {
        "slug": "sunday",
        "date": iso_day(value),
        "day": day_name(value),
        "planKey": "rest",
        "title": "Full rest day",
        "summary": "No training. No catch-up session. Let the system reset so next week starts clean.",
        "status": "Rest locked",
        "builds": ["Recovery", "Adaptation"],
        "morning": {
            "label": "Morning / off",
            "copy": "No gym. Walk if you want, but the day is for recovery.",
        },
        "skill": {
            "label": "Skill block / off",
            "copy": "Rest is part of the skill plan. You get better at hard things by practicing them fresh next week.",
        },
        "bodyweight": "Rest from the daily bodyweight work today.",
        "note": "A short easy walk is fine. Turning Sunday into a stealth training day is not.",
        "evening": {
            "label": "Evening / off",
            "copy": "No formal mobility required. If you feel stiff, do 5-10 easy minutes only.",
        },
        "swaps": ["Optional easy walk", "Optional light stretch", "No formal training"],
    }


def run() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    now = now_ist(args.today)
    today = now.date()
    if not args.sheet_id:
        raise RuntimeError("Missing sheet id. Set GYM_SHEET_ID or pass --sheet-id.")

    existing = load_week_json(repo_root)
    credentials = credentials_from_env(args.credentials_env)
    service = sheets_service(credentials)
    rows, sheet_id_numeric = fetch_sheet(service, args.sheet_id, args.sheet_tab)

    if args.mode == "weekly":
        target_week_start = next_monday(today)
        payload = build_weekly_payload(existing, rows, target_week_start, now)
        planned_rows = log_plan_rows(payload["days"], target_week_start)
        if not args.dry_run:
            save_week_json(repo_root, payload)
            write_rows_for_week(
                service,
                args.sheet_id,
                sheet_id_numeric,
                args.sheet_tab,
                rows,
                target_week_start,
                planned_rows,
                "weekly",
                now,
            )
        print(f"weekly -> {payload['week']['label']}")
        return 0

    current_week_start = monday_of(today)
    payload, changed = adjust_current_week(existing, [row for row in rows if row.week_start == current_week_start], today, now)
    if changed and not args.dry_run:
        save_week_json(repo_root, payload)
        planned_rows = log_plan_rows(payload["days"], current_week_start)
        write_rows_for_week(
            service,
            args.sheet_id,
            sheet_id_numeric,
            args.sheet_tab,
            rows,
            current_week_start,
            planned_rows,
            "nightly",
            now,
        )
    print(f"nightly -> changed={str(changed).lower()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(run())
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise
