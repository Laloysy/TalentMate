# -*- coding: utf-8 -*-
"""Generate the Individual Proposal Report (English).

Chapter order follows the course template exactly:
  1. App Name
  2. Summary of the Project (vision and scope)
  3. Preliminary List of Functional Requirements
  4. Major Functions of the Proposed App and the Related Theory
  5. User Interface Design
  6. Market Research with Competitive Analysis

The course is taught in English, so the whole document is written in English.
All screenshots are captures of the actually running Android build.
"""
import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

REPO = r"D:\学习\我爱学习\前端开发\TalentMate"
SHOTS = os.path.join(REPO, "docs", "proposal-shots")
OUT_DOCX = os.path.join(REPO, "docs", "60249104_CHENYANGZHANG_TalentMate_IndProposalReport.docx")

STUDENT_ID = "60249104"
STUDENT_NAME = "CHENYANG ZHANG"
APP_EN = "TalentMate"
APP_CN = "伴贤"

doc = Document()

# ------------------------------------------------------------------ styles
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
normal.paragraph_format.space_after = Pt(4)
normal.paragraph_format.line_spacing = 1.25

for i, (size, bold) in enumerate([(18, True), (14, True), (12, True), (11, True)], start=1):
    s = doc.styles[f"Heading {i}"]
    s.font.name = "Calibri"
    s.font.size = Pt(size)
    s.font.bold = bold
    s.font.color.rgb = RGBColor(0x1F, 0x2A, 0x37)
    s._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    s.paragraph_format.space_before = Pt(12 if i <= 2 else 8)
    s.paragraph_format.space_after = Pt(6)

for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)


def _r(run):
    """Keep East Asian glyphs (contact names in screenshots' captions) sane."""
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    return run


def H(text, level=1):
    return doc.add_heading(text, level=level)


def P(text="", bold=False, size=None, italic=False, align=None, space_after=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    if space_after is not None:
        p.paragraph_format.space_after = Pt(space_after)
    if text:
        r = _r(p.add_run(text))
        r.bold = bold
        r.italic = italic
        if size:
            r.font.size = Pt(size)
    return p


def RICH(parts, align=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    for text, bold in parts:
        _r(p.add_run(text)).bold = bold
    return p


def BULLET(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_prefix:
        _r(p.add_run(bold_prefix)).bold = True
    _r(p.add_run(text))
    return p


def NUMBER(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Number")
    if bold_prefix:
        _r(p.add_run(bold_prefix)).bold = True
    _r(p.add_run(text))
    return p


def TABLE(headers, rows, widths=None, font_size=9.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = _r(cell.paragraphs[0].add_run(h))
        run.bold = True
        run.font.size = Pt(font_size)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            _r(p.add_run(str(val))).font.size = Pt(font_size)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    return t


def CAPTION(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = _r(p.add_run(text))
    r.font.size = Pt(8.5)
    r.italic = True
    r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
    p.paragraph_format.space_after = Pt(10)


def SHOT(filename, caption, width_cm=5.6):
    path = os.path.join(SHOTS, filename)
    if not os.path.exists(path):
        P(f"[missing screenshot: {filename}]", italic=True)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))
    CAPTION(caption)


def SHOT_ROW(items, width_cm):
    t = doc.add_table(rows=1, cols=len(items))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (fn, cap) in enumerate(items):
        cell = t.rows[0].cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        path = os.path.join(SHOTS, fn)
        if os.path.exists(path):
            p.add_run().add_picture(path, width=Cm(width_cm))
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = _r(p2.add_run(cap))
        r.font.size = Pt(7.5)
        r.italic = True
        r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)


# ================================================================== cover
t = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(t.add_run(f"{APP_EN} ({APP_CN})")).bold = True
t.runs[0].font.size = Pt(26)

s = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(s.add_run("A Voice-Driven Assistant for Maintaining Workplace Relationships")).font.size = Pt(12)
s.runs[0].font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

P()
info = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(info.add_run(f"Individual Proposal Report\n{STUDENT_ID}  {STUDENT_NAME}")).font.size = Pt(11)
P()

# ================================================================== 1
H("1. App Name", level=1)
RICH([("App name: ", True), (f"{APP_EN} (Chinese name {APP_CN})", False)])
RICH([("One-line positioning: ", True),
      ("helps you remember to maintain the relationships that matter, "
       "and reduces the cost of doing so to a single spoken sentence.", False)])
RICH([("Platform: ", True),
      ("native Android application (minimum Android 7.0 / API 24; "
       "developed and tested on Android 15)", False)])
P()

# ================================================================== 2
H("2. Summary of the Project", level=1)

H("2.1 The problem", level=2)
P("Workplace relationships decay silently. When a relationship slides from "
  "\"good\" to \"we have not spoken in months\", nothing announces it: there is no "
  "error, no expiry date, and no signal telling you that it has been 117 days since "
  "you last talked to this person. You only discover it on the day you need something "
  "from them - a referral, a resource, a favour, or simply their decision to stay.")
P("The real problem, however, is not that people do not care. It is that two things "
  "are true at the same time:")
BULLET("relationship health is implicit, and the human brain is poor at tracking the "
       "decay curves of dozens or hundreds of relationships;", "You cannot see it. ")
BULLET("even when you do notice, capturing who, when, what was discussed and when to "
       "follow up has a friction cost high enough that almost nobody sustains it.",
       "You cannot be bothered to record it. ")
RICH([("The second point is the crux. ", True),
      ("Every relationship-management tool eventually dies of the same cause: nobody is "
       "willing to enter the data. CRMs ask salespeople to fill in forms, so they fill "
       "them in perfunctorily; networking apps ask users to take notes manually, so users "
       "abandon them after three sessions. Voice is the only interaction that pushes the "
       "cost of recording close to zero: walk out of an interview, say \"remind me to "
       "follow up with Zhang Wei next Wednesday\", and it is done in three seconds - no "
       "typing, no searching for a contact, no picking a date.", False)])
P("This also explains the timing. Speech recognition only became cheap and accurate "
  "enough to carry an interaction in the last two years. Before that, this product was "
  "not technically viable.", italic=True)

H("2.2 Target users", level=2)
RICH([("Primary users: ", True),
      ("middle managers, HR professionals and recruiters who lead teams of 5-20 people "
       "or own a hiring pipeline. Their results depend directly on the quality of their "
       "relationships, yet that quality is measured by no system. They maintain between "
       "20 and 200 working relationships, which is beyond what memory can track reliably. "
       "They already use a calendar and a contacts app, but the two do not talk to each "
       "other: the calendar knows there is a meeting at 15:00 on Wednesday, but it does "
       "not know that you last spoke to that person 117 days ago.", False)])
RICH([("Secondary users: ", True),
      ("professionals who have been told by a mentor or manager to \"stay in touch with "
       "people\" but have no tooling for it. Their problem is not knowing that they "
       "should reach out, but knowing whom to reach out to and when.", False)])
RICH([("Explicitly not targeted: ", True),
      ("sales teams needing pipeline management (they need a CRM), people who only want "
       "to store phone numbers, and anyone looking for a social network.", False)])

H("2.3 Product vision", level=2)
RICH([("Make maintaining professional relationships so cheap that it no longer requires willpower.", True)],
     align=WD_ALIGN_PARAGRAPH.CENTER)
P("This breaks down into three design principles:")
NUMBER("Every feature must be drivable by voice. This is not \"adding a voice input box\" "
       "but redesigning the information architecture around voice as the primary "
       "interaction. It is also why the product has to be a native app rather than a web "
       "page: microphone access, background notifications and system-level behaviour are "
       "all out of reach in a browser.", "Zero-friction capture is the lifeline. ")
NUMBER("The value is not that the user remembers to open the app, but that the app finds "
       "the user when they have forgotten. Local notifications are therefore a core "
       "feature, not an accessory.", "Proactive reminders, not passive lookup. ")
NUMBER("We help you see which relationships need attention, remember the follow-ups you "
       "committed to, and skip the effort of drafting a message. The actual greeting is "
       "still yours to send - because once an AI sends it for you, care becomes spam.",
       "Remember for you, never decide for you. ")

H("2.4 Scope", level=2)
RICH([("In scope:", True)])
BULLET("Voice-driven creation, querying, cancellation and rescheduling of care events "
       "(the core differentiator)")
BULLET("Contact directory, separating employees from candidates")
BULLET("Relationship health classification (high priority / needs attention / scheduled / healthy)")
BULLET("Care calendar with a monthly view")
BULLET("Reminder configuration and local notification delivery")
BULLET("Automatic generation of care email drafts")
BULLET("Relationship insights: statistics plus an actionable \"people needing attention\" list")
BULLET("Bulk contact import via pasted CSV (solves the cold-start problem)")
P()
RICH([("Explicitly out of scope, and why:", True)])
TABLE(
    ["Out of scope", "Reason"],
    [
        ["Sales pipeline / opportunities / contracts",
         "That is CRM territory; building it would turn us into \"yet another CRM\" and destroy focus"],
        ["Social features (feeds, likes, adding friends)",
         "Workplace relationships are private; making them public would destroy willingness to use the product"],
        ["Team collaboration / shared directories",
         "High complexity around privacy and permissions, and not a core pain point"],
        ["A full email client",
         "We solve drafting only; sending and receiving belong to dedicated tools"],
        ["AI that sends messages automatically",
         "An ethical boundary: care must not be automated on the user's behalf"],
        ["Real-time multi-device sync",
         "Large engineering cost, low value for the core scenario of one person maintaining their own relationships"],
        ["Two-way third-party calendar sync",
         "Valuable but not essential, and platform differences would derail the schedule"],
        ["Analytics / report export",
         "A personal productivity product does not need BI"],
    ],
    widths=[5.5, 10.0],
)
P()
RICH([("Decision rule: ", True),
      ("if a feature does not serve \"reducing the friction of maintaining relationships\", "
       "we do not build it. Better narrow and deep than broad and shallow.", False)])

doc.add_page_break()

# ================================================================== 3
H("3. Preliminary List of Functional Requirements", level=1)
P("Priority: P0 = required for the product to exist at all; P1 = supports the main flow; "
  "P2 = experience polish.")
TABLE(
    ["ID", "Module", "Description", "Priority"],
    [
        ["FR-01", "Speech recognition", "Capture microphone audio and transcribe it to text", "P0"],
        ["FR-02", "Intent parsing", "Extract intent type, contact, time and subject from natural language", "P0"],
        ["FR-03", "Voice event creation", "Create a care event and set its reminder from one sentence", "P0"],
        ["FR-04", "Contact matching", "Match a spoken name to the directory; ask the user when ambiguous", "P0"],
        ["FR-05", "Relationship status", "Derive relationship health from interaction intervals", "P0"],
        ["FR-06", "Attention list", "List contacts needing attention with an explainable reason", "P0"],
        ["FR-07", "Local notifications", "Deliver a reminder ahead of each event, per its lead time", "P0"],
        ["FR-08", "Contact management", "Create, read, update and delete contacts (name / email / department / role)", "P0"],
        ["FR-09", "Event management", "Manually create, edit and delete care events", "P0"],
        ["FR-10", "Authentication", "Registration, login, session persistence and expiry handling", "P0"],
        ["FR-11", "Calendar view", "Monthly view of events with month and mode switching", "P1"],
        ["FR-12", "Contact detail", "Profile, relationship status and interaction timeline", "P1"],
        ["FR-13", "Email drafts", "Generate an editable, previewable care draft from an event and contact", "P1"],
        ["FR-14", "CSV import", "Bulk-import contacts by pasting CSV", "P1"],
        ["FR-15", "Voice query", "Ask about the schedule for a given period by voice", "P1"],
        ["FR-16", "Voice cancel / reschedule", "Cancel or move an existing event by voice", "P1"],
        ["FR-17", "Email sending", "Send the care email over SMTP", "P1"],
        ["FR-18", "Relationship insights", "Distribution statistics and care overview", "P1"],
        ["FR-19", "Permission handling", "Runtime permission requests for microphone and notifications, with graceful degradation", "P1"],
        ["FR-20", "Failure feedback", "Give an understandable message on network or recognition failure instead of failing silently", "P1"],
        ["FR-21", "Unsaved-change guard", "Confirm before leaving a form with unsaved edits", "P2"],
        ["FR-22", "Onboarding", "Explain the value and guide the first actions for new users", "P2"],
        ["FR-23", "Long-text adaptation", "Truncate over-long names and departments gracefully without breaking layout", "P2"],
    ],
    widths=[1.5, 2.7, 8.3, 1.6],
)

doc.add_page_break()

# ================================================================== 4
H("4. Major Functions of the Proposed App and the Related Theory", level=1)
P("This chapter describes the three core functions, the user stories behind them, and "
  "the design theory they rest on. All of them are implemented and verified on Android.")

H("4.1 Core function 1: creating a care event by voice", level=2)
RICH([("User story. ", True),
      ("As a recruiter who has just finished an interview, I want to record \"follow up "
       "with Zhang Wei on the offer next Wednesday\" in one sentence, so that I do not have "
       "to open a form and fill in six fields - because before I finish, the thought has "
       "already been pushed out of my head by the next task.", False)])
P()
RICH([("What it does. ", True),
      ("The user taps the microphone and speaks one sentence. The system then performs, in "
       "order: speech recognition, intent parsing, contact matching, event creation with a "
       "reminder, email draft generation, and result feedback. For example, saying \"arrange "
       "a one-on-one with Zhang Wei tomorrow at 3pm\" creates an event the next day at 15:00, "
       "binds it to the contact Zhang Wei, and generates an email draft.", False)])
P()
RICH([("Related theory.", True)])
BULLET("Speech is a higher-bandwidth input channel than a keyboard, particularly in mobile "
       "situations where the user's hands are occupied or where typing a long sentence in "
       "public is undesirable. The point is not that voice is novel, but that it reduces the "
       "input cost of one record from roughly 30 seconds to roughly 3 seconds - which crosses "
       "the threshold at which users will actually sustain the habit.", "Input efficiency. ")
BULLET("Research on natural-language interaction shows that users' trust in a system depends "
       "on how easy it is to recover from errors, not on the error rate itself. We therefore "
       "treat \"ask the user when contact names are ambiguous\", \"state clearly when "
       "recognition fails\" and \"support voice cancellation and rescheduling\" as required "
       "capabilities rather than nice-to-haves.", "Fault-tolerant conversational design. ")
BULLET("Mapping unstructured natural language onto structured slots. Our slots are: intent "
       "type, contact, start time, event title and reminder lead time. This is the hardest part "
       "of the function and also the most error-prone.", "Intent and slot filling. ")

H("4.2 Core function 2: relationship status and the \"people needing attention\" list", level=2)
RICH([("User story. ", True),
      ("As an engineering manager leading twelve people, I want to know exactly which "
       "individuals need my attention, so that the vague self-instruction \"I should care more "
       "about my team\" turns into three concrete things I can do today.", False)])
P()
RICH([("What it does. ", True),
      ("Based on the time elapsed since the most recent interaction with each contact, the "
       "system classifies them into high priority, needs attention, scheduled, or healthy, and "
       "surfaces them as a list on the home and insights screens together with an explainable "
       "reason (for example, \"117 days without contact - consider arranging a conversation\"). "
       "The user can move straight from that list into scheduling.", False)])
P()
RICH([("Related theory.", True)])
BULLET("There is a cognitive ceiling on the number of stable social relationships a person can "
       "maintain (Dunbar's number, around 150). The number of relationships a professional must "
       "maintain often approaches or exceeds that ceiling, so \"who deserves attention\" cannot "
       "be left to memory - it has to be externalised as system state.",
       "Cognitive load and relationship capacity. ")
BULLET("Structural hole theory argues that weak ties bridging different groups carry higher "
       "informational value - and weak ties are precisely the ones most easily forgotten. This "
       "supports our design choice to prompt proactively about people who have not been "
       "contacted for a long time.", "Social capital. ")
BULLET("State assessment and action triggering are separated. The system only tells you who "
       "needs attention; it does not decide what you should say. This both narrows the system's "
       "responsibility and avoids the sense of imposition that automated care creates.",
       "Reminder-system design. ")

H("4.3 Core function 3: proactive reminders via local notifications", level=2)
RICH([("User story. ", True),
      ("As an HR professional running several hiring pipelines at once, I want a reminder "
       "before an interview starts, so that I actually maintain that relationship instead of "
       "missing it once again.", False)])
P()
RICH([("What it does. ", True),
      ("Each event carries a reminder lead time (10 minutes by default). The system schedules "
       "it locally on the device and delivers a notification; tapping it opens the "
       "corresponding event. Notification text is generated automatically (for example, "
       "\"in 10 minutes: interview with Zhang Wei\") and over-long names are truncated so the "
       "layout does not overflow.", False)])
P()
RICH([("Related theory.", True)])
BULLET("Repeating a behaviour at fixed intervals helps convert it into a long-term habit. The "
       "value of a reminder is not the notification itself but the way it turns an occasional "
       "act of care into a stable habit.", "Spaced repetition. ")
BULLET("The effectiveness of reminders is not linear in frequency. Too many reminders push "
       "users to turn notifications off - and once notifications are off, this product's core "
       "value disappears entirely. We therefore treat \"never request notification permission "
       "during onboarding\" as a hard design rule: the request appears only when the user "
       "genuinely needs it, after saving an event with a reminder or when switching the "
       "reminder toggle on.", "Notification fatigue and permission psychology. ")

H("4.4 Other core functions", level=2)
TABLE(
    ["Function", "User story", "Key point"],
    [
        ["Care email drafts",
         "As someone who needs to reach out, I want a draft already written, so that I only have to change a few words before sending.",
         "Generated from the contact profile and the event, lowering the cost of the maintenance action itself"],
        ["Bulk CSV import",
         "As someone who has just taken over a new team, I want to paste a CSV once, so that I do not have to enter people one by one.",
         "Solves cold start; without it new users face an empty directory and churn"],
        ["Ambiguous contact disambiguation",
         "When the name I say matches several contacts, I want the system to ask me which one, so that the event is not attached to the wrong person.",
         "The most typical failure mode in voice interaction; it must be handled explicitly rather than silently guessed"],
        ["Relationship insights",
         "As a user, I want to see the distribution of relationship states, so that I can judge whether my attention has been balanced lately.",
         "Turning the invisible into the visible is where the product's value comes from"],
    ],
    widths=[2.6, 7.4, 5.5],
)

doc.add_page_break()

# ================================================================== 5
H("5. User Interface Design", level=1)
P("This chapter presents the interface design. All screenshots are captures of the running "
  "Android build (Pixel 3a, Android 15) and have not been retouched or composited. They "
  "include both steady-state screens and intermediate states of interactions, because the "
  "value of this product lies in its interaction flow rather than in static pages.")

H("5.1 Authentication and onboarding", level=2)
P("First-time use requires a short sequence that establishes the value and then builds the "
  "directory. The quality of this conversion determines whether a user ever reaches the core "
  "value, so it is treated as a design object in its own right.")
SHOT("a1-login-empty.png", "Figure 1  Login: only the brand, the one-line value proposition and two inputs, to lower the cost of first entry", 5.2)
SHOT("a2-login-error.png", "Figure 2  Login validation failure: the error is shown inline rather than in a blocking dialog", 5.2)
SHOT("a3-register.png", "Figure 3  Registration: four fields in a single step, avoiding the drop-off caused by multi-step signup", 5.2)
SHOT_ROW([
    ("b1-onboarding.png", "Figure 4  Onboarding 1: build the directory"),
    ("b2-onboarding.png", "Figure 5  Onboarding 2: view relationship health"),
    ("b3-onboarding.png", "Figure 6  Onboarding 3: arrange interactions by voice"),
], 4.3)

H("5.2 Empty states", level=2)
P("A new user arrives with no data at all. Empty states are the most easily neglected screens "
  "and among the most influential for retention, so each main screen gets its own design.")
SHOT_ROW([
    ("c1-home-empty.png", "Figure 7  Home empty state: statistics at zero, pointing clearly at \"add a contact\""),
    ("c2-contacts-empty.png", "Figure 8  Directory empty state: offers the add entry point directly instead of just \"no data\""),
], 4.4)
SHOT_ROW([
    ("c3-insights-empty.png", "Figure 9  Insights empty state: keeps the statistical frame so users expect what will appear"),
    ("c4-calendar-empty.png", "Figure 10  Calendar empty state: explains that events can be created by voice, guiding users to the core feature"),
], 4.4)

H("5.3 Home: relationship overview and today's schedule", level=2)
SHOT("e1-home.png", "Figure 11  Home: four relationship statistics, today's schedule, people needing attention, and quick actions", 5.6)
BULLET("The four statistics answer \"is my relationship health reasonable overall?\"; tapping them opens the insights screen.")
BULLET("\"People needing attention\" gives the name, the status label and the reason directly, "
       "turning a vague intention into an actionable list.")
BULLET("Quick actions offer the three most frequent entry points (new event / add contact / "
       "voice), with the voice entry emphasised in solid blue to steer users toward a "
       "voice-first habit.")
BULLET("Four bottom tabs (Home / Calendar / Directory / Insights) with the voice floating "
       "button pinned bottom-right, so voice input is one tap away from any screen.")

H("5.4 Calendar and event form", level=2)
SHOT("e2-calendar.png", "Figure 12  Calendar: grouped by day; each card shows a type tag, title, time range and reminder", 5.6)
SHOT("d3-event-drawer-empty.png", "Figure 13  New event drawer (empty): required fields are marked with a red asterisk", 5.6)
SHOT("d4-event-drawer-filled.png", "Figure 14  New event drawer (filled): date and time are separate inputs, reducing mis-taps in the mobile date picker", 5.6)
SHOT("j1-event-actions.png", "Figure 15  Event card actions: edit and delete are tucked into a menu so that destructive actions are not on the main surface", 5.6)
BULLET("Supports switching between \"Care\" and \"This month\"; arrows change the month, and today is marked with a red dot and the date.")
BULLET("Design trade-off: the voice floating button is hidden on the calendar and assistant "
       "screens so that it cannot cover the last row of the calendar.")
BULLET("\"Linked contact\" is optional - deliberately, so that a user who has not created any "
       "contacts yet can still record a to-do.")

H("5.5 Directory and contact detail", level=2)
SHOT("e3-contacts.png", "Figure 16  Directory: search field, group filters, and contact cards carrying the relationship status label", 5.6)
SHOT("d1-contact-form.png", "Figure 17  New contact form: name and email are primary; department and role feed later grouping", 5.6)
SHOT("d2-contact-form-filled.png", "Figure 18  New contact form (filled in)", 5.6)
SHOT("f2-contact-timeline.png", "Figure 19  Contact detail: avatar, organisation info, relationship status and three primary actions, with the interaction timeline below ordered newest-first (date plus type tag)", 5.6)
SHOT("f3-contact-edit.png", "Figure 20  Edit profile sheet: opens in place from the detail screen instead of navigating away, preserving context", 5.6)
BULLET("Directory cards show relationship status directly (for example, \"high priority - 117 days without contact\"), "
       "so users can judge whether action is needed without opening the detail screen.")
BULLET("The status comes with an explainable reason (for example, \"interaction within the last 5 days\") rather than a bare score.")
BULLET("The group filters (all / employees / candidates) reflect the two main identities in workplace relationships.")
BULLET("\"Paste CSV\" sits alongside the filters as a tag, lowering the cost of discovering bulk import.")

H("5.6 Relationship insights", level=2)
SHOT("e4-insights.png", "Figure 21  Insights: four-quadrant statistics plus contacts grouped by status", 5.6)
BULLET("The four quadrants are colour-coded (red = high priority, amber = needs attention, "
       "blue = scheduled, green = healthy); the colour carries the meaning, making it fast to read.")
BULLET("Each group lists the contacts and the reason below it and offers an entry point into "
       "scheduling, so there is no break between seeing a problem and acting on it.")

H("5.7 Voice assistant: the core interaction flow", level=2)
P("This is the product's central interaction surface, so the full flow is shown rather than a "
  "single static screen.")
SHOT("g1-assistant-idle.png", "Figure 22  Assistant initial state: empty conversation area with the bottom hint \"tap the microphone and say the contact, the time and the matter\"", 5.6)
SHOT("g2-assistant-suggestion.png", "Figure 23  After choosing a suggested example: the phrasing appears in the input box so the user can edit and send it", 5.6)
SHOT("g3-assistant-recording.png", "Figure 24  Recording: the microphone button switches to the recording state and the copy becomes \"recording, tap again to stop\"", 5.6)
SHOT("g4-assistant-result.png", "Figure 25  Recognition and execution result: the recognised text, the action taken and the created event, with the calendar showing the new entry", 5.6)
BULLET("The empty state offers four typical phrasings (a 1:1, an HR interview follow-up, and so "
       "on), addressing the learning cost inherent to a new interaction modality: \"how am I "
       "supposed to talk to it?\"")
BULLET("The microphone button is considerably larger than any other control and is the only "
       "strong visual focus on the screen.")
BULLET("The conversation keeps history as bubbles, so the user can review what they said and "
       "what the system understood - especially important when recognition goes wrong.")

H("5.8 Email editor", level=2)
SHOT("h1-mail-editor.png", "Figure 26  Email editor: subject and body are editable, with \"save draft\" at the top", 5.6)
SHOT("h2-mail-preview.png", "Figure 27  Preview: rendered through the care-email template, with an entry point to refresh the preview", 5.6)
SHOT("h3-mail-unsaved-confirm.png", "Figure 28  Unsaved-change guard: leaving with a modified body asks for confirmation, preventing accidental loss", 5.6)

H("5.9 Settings and permissions", level=2)
SHOT("i1-settings.png", "Figure 29  Settings: account information, the reminder toggle and the lead-time setting", 5.6)
SHOT("i2-settings-bottom.png", "Figure 30  Settings (bottom): care frequency, about information and sign out", 5.6)
SHOT("j3-permission-notification.png", "Figure 31  Notification permission request: triggered only after the user turns the reminder toggle on, never during onboarding", 5.6)
SHOT("j4-permission-microphone.png", "Figure 32  Microphone permission request: triggered by tapping record, and offering \"allow only while using the app\"", 5.6)
BULLET("The timing of permission requests is a deliberate product decision: ask at the moment "
       "the user genuinely needs the capability. Asking too early leads to habitual refusal, "
       "and once refused the related feature is dead.")

H("5.10 Notifications, failure feedback and edge cases", level=2)
SHOT("j2-notification-shade.png", "Figure 33  A reminder in the system notification shade: icon, app name and reminder text", 5.6)
SHOT("j5-permission-denied-feedback.png", "Figure 34  Feedback after a permission is denied: an understandable explanation and a path forward instead of silent failure", 5.6)
SHOT("k1-long-text.png", "Figure 35  Long-text adaptation: a 15-character name and a long department name truncate with an ellipsis and produce no horizontal scrolling", 5.6)

P()
RICH([("Interface design principles in summary:", True)])
BULLET("every screen that requires input must have a voice path; forms without one are treated as secondary.", "Voice first: ")
BULLET("relationship status lives on the list card, not buried in a detail screen.", "Information up front: ")
BULLET("seeing a problem and acting on it are never more than one tap apart.", "No break in the loop: ")
BULLET("empty states, failure states and permission states are designed explicitly; only the happy path is not enough.", "Complete states: ")
BULLET("touch targets are at least 40px and the bottom navigation sits inside the safe area, clear of system gestures.", "Mobile reachability: ")

doc.add_page_break()

# ================================================================== 6
H("6. Market Research with Competitive Analysis", level=1)

H("6.1 Market background", level=2)
P("Maintaining workplace relationships has always depended on personal habit rather than "
  "tooling. Existing tools fall into five categories and none of them actually solves the "
  "problem of silent relationship decay. Notably, these tools are not unaware that "
  "relationship management matters; they simply all fail on the same fatal point: the friction "
  "of data entry is too high.")

H("6.2 Competitive analysis", level=2)
TABLE(
    ["Category", "Representative products", "Strengths", "Limitations (our opportunity)"],
    [
        ["System contacts", "Android / iOS Contacts",
         "Everyone has it; zero install cost",
         "Static information only; never prompts you to maintain a relationship; no interaction history"],
        ["Calendar apps", "Google Calendar, system calendar",
         "Mature time management and ecosystem",
         "Knows what meetings exist but not how long since you spoke to someone; no relationship dimension"],
        ["Instant messaging", "WeChat, WeCom, Slack",
         "Where communication actually happens",
         "Communication tools, not relationship tools: no recording, no reminders, no relationship statistics"],
        ["CRM systems", "Salesforce, HubSpot",
         "Powerful relationship management and process support",
         "Built for sales teams, heavy and expensive; demands extensive manual entry, so salespeople fill forms perfunctorily"],
        ["Networking apps", "Various contact / networking managers",
         "Conceptually aligned with the need",
         "Depend on manual note-taking, poor entry experience; users typically abandon them after three sessions"],
    ],
    widths=[2.2, 3.4, 3.4, 6.5],
)

H("6.3 How our idea differs", level=2)
NUMBER("This is the only genuine differentiator, and it is precisely the problem other tools "
       "have failed to solve. Competitors did not overlook relationship management; they could "
       "not bring the cost of recording an interaction down to a level users would sustain. "
       "Voice compresses that cost from roughly 30 seconds to roughly 3 seconds.",
       "We push entry friction close to zero. ")
NUMBER("Microphone access, background notifications and system-level reminders are exactly the "
       "preconditions of the proactive-reminder principle. A web-only approach would forfeit "
       "half the product's value.", "Native mobile first, not web. ")
NUMBER("Care only, not sales. This brings two benefits: it targets individuals rather than "
       "teams, so privacy pressure is lower and the decision chain is short; and the concept is "
       "simple enough to be understood without training.", "Focused on workplace care, not a CRM. ")
NUMBER("Most tools stop at helping you record. We answer \"whom should I contact today?\" and "
       "hand over an executable list with an entry point.", "From a record-keeper to an action advisor. ")

H("6.4 Our moat is shallow - an honest assessment", level=2)
P("A proposal report should state plainly that the competitive barrier here is limited: speech "
  "recognition is a publicly available cloud capability, relationship classification is a "
  "replicable rule, and email drafting is already commoditised. Only two things could become a "
  "real moat:")
BULLET("the robustness of voice in real conditions - noisy environments, regional accents, and "
       "users misspeaking. This determines whether users trust the product. One serious "
       "misrecognition (attaching an event to the wrong person, for instance) damages retention "
       "more than ten successes.", "The care taken over interaction polish: ")
BULLET("thresholds such as \"117 days without contact counts as needing attention\" vary hugely "
       "across relationship types: a direct report may be a fortnight, a cross-department "
       "colleague six months. A single threshold both misses cases and raises false alarms, and "
       "false alarms burn through user patience quickly. Calibrating this requires real usage "
       "data.", "The accuracy of the relationship model: ")

H("6.5 Main product risks", level=2)
TABLE(
    ["Risk", "Description", "Mitigation direction"],
    [
        ["Voice robustness is make-or-break",
         "Misrecognition in noisy conditions or with accents destroys trust entirely",
         "Ask when names are ambiguous; state failures clearly instead of failing silently; support cancellation and rescheduling"],
        ["A single threshold may not hold",
         "Reasonable contact frequency differs greatly by relationship type, and false alarms consume patience",
         "Set thresholds per relationship type and let users adjust them"],
        ["Cold start is high friction",
         "A new user facing an empty directory is likely to leave immediately",
         "Strengthen CSV import guidance; prompt users to add a contact when the directory is empty"],
        ["Privacy sensitivity",
         "\"How long since contact\" is sensitive workplace data, and users worry about its use",
         "Strict per-account data isolation; a clear commitment to use it for no evaluative purpose"],
        ["Reminders can turn into nuisance",
         "Too many reminders make users disable notifications, destroying the core value",
         "Strictly control when permission is requested; make reminder frequency configurable"],
    ],
    widths=[2.8, 5.8, 7.0],
)

H("6.6 How we would validate these judgements", level=2)
TABLE(
    ["Assumption to test", "How to validate"],
    [
        ["Voice really is less effort than typing", "Compare the time to create the same event by voice versus manually"],
        ["The \"needs attention\" list actually gets used", "View rate of the insights screen; conversion from that screen into a scheduled event"],
        ["Reminders are acted on rather than switched off", "Notification tap-through rate; rate at which notification permission is revoked"],
        ["Whether the relationship threshold is reasonable", "User acceptance of the \"high priority\" label (how often it is ignored)"],
    ],
    widths=[6.0, 9.5],
)
P()
RICH([("The single most important metric is the conversion rate from the insights screen into a scheduled care event. ", True),
      ("If users look at \"people needing attention\" and never act, then this product is an amusing "
       "voice demo rather than something that solves a real problem.", False)])

# ================================================================== 7
P()
H("7. Conclusion", level=1)
P("Workplace relationships decay silently, and people do not fail to care - they fail to "
  "remember and cannot be bothered to record. TalentMate drives the cost of recording close to "
  "zero with voice, tells you whom to care about today, and reminds you before the moment "
  "arrives, making the maintenance of relationships sustainable for the first time.")
RICH([("Product boundary: ", True),
      ("we help you remember and arrange. The greeting itself is still yours to send.", False)])

doc.save(OUT_DOCX)
print("DOCX:", OUT_DOCX)
print("size: %.1f KB" % (os.path.getsize(OUT_DOCX) / 1024))
