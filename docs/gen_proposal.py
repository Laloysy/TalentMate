# -*- coding: utf-8 -*-
"""生成个人提案报告 (Word)。

按课程模板章节顺序组织：
  1. App Name
  2. Summary of the project (vision + scope)
  3. Preliminary list of functional requirements
  4. Major functions and the related theory (含 user stories)
  5. User Interface Design (嵌入 36 张真实运行截图，含静态页面与交互态)
  6. Market Research with competitive analysis
"""
import os

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

REPO = r"D:\学习\我爱学习\前端开发\TalentMate"
SHOTS = os.path.join(REPO, "docs", "proposal-shots")
OUT_DIR = os.path.join(REPO, "docs")
OUT_DOCX = os.path.join(OUT_DIR, "60249104_张辰阳_TalentMate_IndProposalReport.docx")

STUDENT_ID = "60249104"
STUDENT_NAME = "张辰阳"
PROJECT = "TalentMate 伴贤"
CN_FONT = "微软雅黑"

doc = Document()

style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(10.5)
style._element.rPr.rFonts.set(qn("w:eastAsia"), CN_FONT)
style.paragraph_format.space_after = Pt(4)
style.paragraph_format.line_spacing = 1.25

for i, (size, bold) in enumerate([(18, True), (14, True), (12, True), (11, True)], start=1):
    s = doc.styles[f"Heading {i}"]
    s.font.name = "Calibri"
    s.font.size = Pt(size)
    s.font.bold = bold
    s.font.color.rgb = RGBColor(0x1F, 0x2A, 0x37)
    s._element.rPr.rFonts.set(qn("w:eastAsia"), CN_FONT)
    s.paragraph_format.space_before = Pt(12 if i <= 2 else 8)
    s.paragraph_format.space_after = Pt(6)

for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)


def _cn(run):
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), CN_FONT)
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
        r = _cn(p.add_run(text))
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
        _cn(p.add_run(text)).bold = bold
    return p


def BULLET(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_prefix:
        _cn(p.add_run(bold_prefix)).bold = True
    _cn(p.add_run(text))
    return p


def NUMBER(text, bold_prefix=None):
    p = doc.add_paragraph(style="List Number")
    if bold_prefix:
        _cn(p.add_run(bold_prefix)).bold = True
    _cn(p.add_run(text))
    return p


def TABLE(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        _cn(cell.paragraphs[0].add_run(h)).bold = True
        for r in cell.paragraphs[0].runs:
            r.font.size = Pt(9.5)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            _cn(p.add_run(str(val))).font.size = Pt(9.5)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    return t


def CAPTION(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = _cn(p.add_run(text))
    r.font.size = Pt(8.5)
    r.italic = True
    r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)
    p.paragraph_format.space_after = Pt(10)


def SHOT(filename, caption, width_cm=5.6):
    path = os.path.join(SHOTS, filename)
    if not os.path.exists(path):
        P(f"[缺少截图: {filename}]", italic=True)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width_cm))
    CAPTION(caption)


def SHOT_ROW(items, width_cm):
    """一行放多张截图，items: [(filename, caption), ...]"""
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
        r = _cn(p2.add_run(cap))
        r.font.size = Pt(7.5)
        r.italic = True
        r.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)


# ================================================================ 标题
t = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_cn(t.add_run(PROJECT)).bold = True
t.runs[0].font.size = Pt(26)

s = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_cn(s.add_run("语音驱动的职场关系维护助手")).font.size = Pt(12)
s.runs[0].font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

P()
info = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_cn(info.add_run(f"Individual Proposal Report\n{STUDENT_ID}  {STUDENT_NAME}")).font.size = Pt(11)
P()

# ================================================================ 1
H("1. App Name", level=1)
RICH([("应用名称：", True), (f"{PROJECT}（英文名 TalentMate）", False)])
RICH([("一句话定位：", True), ("帮你记得去维护重要的人，并把维护成本降到「说一句话」。", False)])
RICH([("运行平台：", True), ("Android 手机应用（最低 Android 7.0 / API 24，已在 Android 15 上实测运行）", False)])
P()

# ================================================================ 2
H("2. Summary of the Project", level=1)

H("2.1 要解决的问题", level=2)
P("职场里的关系衰减是静默发生的。一个人从「关系不错」滑到「很久没联系」，"
  "中间没有任何事件提示你——没有报错、没有到期提醒、没有任何东西告诉你"
  "「你已经 117 天没和这个人说过话了」。直到某天你需要他（要内推、要资源、"
  "要配合、要挽留），才发现这段关系已经凉了。")
P("但真正的问题不是「人们不在乎」，而是两件事同时成立：")
BULLET("关系状态是隐性的，而人脑并不擅长追踪几十上百条关系的衰减曲线；", "看不见 —— ")
BULLET("即使意识到了，把「和谁、什么时候、聊了什么、下次该何时跟进」记录下来，"
       "摩擦成本高到没有人会长期坚持。", "记不下来 —— ")
RICH([("第二点才是关键。", True),
      ("所有关系管理工具最终都死于同一件事：没人愿意录入数据。"
       "CRM 要求销售填表单，所以销售敷衍地填；人脉管理 App 要求手动记笔记，"
       "所以用户用三次就放弃了。语音是唯一能把录入摩擦降到接近零的交互方式："
       "刚结束一场面试，走出会议室，说一句「下周三提醒我和张三跟进一下 offer」——"
       "3 秒，不用打字、不用翻联系人、不用选日期。", False)])
P("这也解释了为什么是现在：语音识别在过去两年才真正便宜且准确到足以支撑交互。"
  "在此之前，这个产品在技术上并不成立。", italic=True)

H("2.2 目标用户", level=2)
RICH([("主要用户：", True),
      ("中基层管理者、HR、招聘。他们带 5–20 人团队或负责招聘，"
       "工作成绩直接取决于关系质量，但关系质量不被任何系统度量；"
       "同时维护 20–200 条工作关系，已超出人脑可靠追踪的范围。"
       "他们已经在用日历和通讯录，但两者互不相通——"
       "日历知道「周三 15:00 有会」，却不知道「你和这个人上次聊天是 117 天前」。", False)])
RICH([("次要用户：", True),
      ("被导师或领导告知「要多跟人保持联系」，却没有任何工具化方法的职场人。"
       "他们的问题不是不知道要联系，而是不知道联系谁、什么时候联系。", False)])
RICH([("明确不服务：", True),
      ("需要销售漏斗管理的销售团队（他们要的是 CRM）、只想存电话号码的人、"
       "以及想社交的人。", False)])

H("2.3 产品愿景", level=2)
RICH([("让职业关系的维护成本低到不需要意志力。", True)], align=WD_ALIGN_PARAGRAPH.CENTER)
P("拆解为三条设计原则：")
NUMBER("所有功能都必须能被语音驱动。这不是「加一个语音输入框」，"
       "而是以语音为主交互来重新设计信息架构。这也是为什么必须做原生 App 而不是网页："
       "麦克风权限、后台通知、系统级体验，在浏览器里都做不到。", "零摩擦录入是生命线 —— ")
NUMBER("产品价值不体现在「用户想起来打开它」，而体现在用户没想起来的时候它主动找你。"
       "因此本地通知是核心功能，而不是附属功能。", "主动提醒，而非被动查询 —— ")
NUMBER("我们只让你看见该维护的关系、记得要做的跟进、省掉起草的力气。"
       "最终那句问候仍然要你自己说——一旦 AI 替你说，关怀就变成了打扰。",
       "只做「记得」，不做「替你决定」—— ")

H("2.4 项目范围（Scope）", level=2)
RICH([("纳入范围：", True)])
BULLET("语音建日程 / 查询 / 取消改期（产品的核心差异点）")
BULLET("联系人名册，区分员工与候选人")
BULLET("关系状态判定（高优先级 / 需关注 / 已安排 / 正常）")
BULLET("关怀日程与月度日历视图")
BULLET("提醒设置与本地通知推送")
BULLET("关怀邮件草稿自动生成")
BULLET("关系洞察（统计与「需要关注的人」清单）")
BULLET("CSV 批量导入联系人（解决冷启动）")
P()
RICH([("明确不做，以及为什么：", True)])
TABLE(
    ["不做", "原因"],
    [
        ["销售漏斗 / 商机 / 合同管理", "那是 CRM 的领域，做了就会变成「又一个 CRM」，失去聚焦"],
        ["社交功能（动态、点赞、加好友）", "职场关系是私密的，公开化会摧毁使用意愿"],
        ["团队协作 / 共享名册", "涉及隐私与权限，复杂度极高，且不是核心痛点"],
        ["完整邮件客户端", "我们只解决「起草」，收发交给专业工具"],
        ["AI 自动发送消息", "产品伦理边界：关怀不能被自动化代劳"],
        ["多端实时同步", "工程量大，对「个人维护关系」这一核心场景收益低"],
        ["第三方日历双向同步", "有价值但非必需，且平台差异大，容易拖垮进度"],
        ["数据分析 / 报表导出", "面向个人的产品不需要 BI"],
    ],
    widths=[5.5, 10.0],
)
P()
RICH([("判断标准：", True),
      ("如果某个功能不能服务于「降低关系维护的摩擦」，就不做。宁可窄而深，不要宽而浅。", False)])

doc.add_page_break()

# ================================================================ 3
H("3. Preliminary List of Functional Requirements", level=1)
P("优先级定义：P0 为产品成立的必要条件；P1 为支撑主流程；P2 为体验完善。")
TABLE(
    ["编号", "功能模块", "功能描述", "优先级"],
    [
        ["FR-01", "语音识别", "采集麦克风音频并转为中文文本", "P0"],
        ["FR-02", "意图解析", "从自然语言抽取意图类型、联系人、时间、事项", "P0"],
        ["FR-03", "语音建日程", "一句话创建关怀日程并设置提醒", "P0"],
        ["FR-04", "联系人匹配", "将语音中的人名匹配到名册；重名时请求用户确认", "P0"],
        ["FR-05", "关系状态判定", "根据时间间隔与互动记录计算关系状态", "P0"],
        ["FR-06", "关注清单", "列出需要关注的联系人并给出可解释的原因", "P0"],
        ["FR-07", "本地通知", "日程开始前按设定提前量推送提醒", "P0"],
        ["FR-08", "联系人管理", "联系人增删改查（姓名 / 邮箱 / 部门 / 岗位）", "P0"],
        ["FR-09", "日程管理", "手动创建、编辑、删除关怀日程", "P0"],
        ["FR-10", "用户认证", "注册、登录、登录态维持与失效处理", "P0"],
        ["FR-11", "日历视图", "按月展示日程，支持切换月份与视图", "P1"],
        ["FR-12", "联系人详情", "资料、关系状态与互动时间线", "P1"],
        ["FR-13", "邮件草稿", "基于日程与联系人生成关怀邮件草稿，可编辑与预览", "P1"],
        ["FR-14", "CSV 导入", "粘贴 CSV 批量导入联系人", "P1"],
        ["FR-15", "语音查询", "用语音查询指定时间范围的安排", "P1"],
        ["FR-16", "语音取消改期", "用语音取消或调整已有日程", "P1"],
        ["FR-17", "邮件发送", "通过 SMTP 发送关怀邮件", "P1"],
        ["FR-18", "关系洞察", "关系状态分布统计与关怀概览", "P1"],
        ["FR-19", "权限管理", "麦克风与通知的运行时权限申请与降级处理", "P1"],
        ["FR-20", "异常反馈", "网络或识别异常时给出可理解提示，不静默失败", "P1"],
        ["FR-21", "未保存保护", "表单有未保存内容时返回需二次确认", "P2"],
        ["FR-22", "新手引导", "首次使用的价值说明与操作引导", "P2"],
        ["FR-23", "长文本适配", "超长姓名 / 部门在列表中优雅截断，不破坏布局", "P2"],
    ],
    widths=[1.6, 2.6, 8.4, 1.6],
)

doc.add_page_break()

# ================================================================ 4
H("4. Major Functions and the Related Theory", level=1)
P("本章说明三个核心功能、对应的用户故事，以及背后的设计理论。"
  "以下功能均已在 Android 端实现并验证。")

H("4.1 核心功能一：语音建关怀日程", level=2)
RICH([("用户故事。", True),
      ("作为一名刚结束面试的招聘专员，我想用一句话记录「下周三跟进张三的 offer」，"
       "这样我就不必打开表单填写六项内容——因为在我填完之前，"
       "这件事已经从我的记忆里被下一件事冲掉了。", False)])
P()
RICH([("功能说明。", True),
      ("用户点击麦克风说出一句话，系统依次完成：语音识别 → 意图解析 → 联系人匹配 → "
       "创建日程并设置提醒 → 生成邮件草稿 → 反馈结果。"
       "例如说「明天下午三点安排和张伟的一对一沟通」，系统会创建次日 15:00 的日程、"
       "绑定联系人「张伟」、并生成邮件草稿。", False)])
P()
RICH([("相关理论。", True)])
BULLET("语音是比键盘更高带宽的输入通道，尤其在「双手被占用、"
       "或不愿在公共场合打长句」的移动场景下。本产品的关键不是「语音更酷」，"
       "而是把一条记录的输入成本从约 30 秒降到约 3 秒——跨越了用户愿意坚持的阈值。",
       "输入效率理论：")
BULLET("自然语言交互的研究指出，用户对系统的信任取决于错误恢复的容易程度，"
       "而非错误率本身。因此我们把「联系人重名时请求确认」「识别失败时明确提示」"
       "「支持语音取消与改期」作为必需能力，而不是可选项。", "对话式交互的容错设计：")
BULLET("把非结构化自然语言映射为结构化槽位。本产品的槽位为：意图类型、联系人、"
       "开始时间、事项标题、提醒提前量。这是本功能的核心技术难点，也是最易出错的一环。",
       "意图与槽位抽取：")

H("4.2 核心功能二：关系状态判定与「需要关注的人」", level=2)
RICH([("用户故事。", True),
      ("作为一名带 12 人团队的研发经理，我想知道具体是哪几个人需要我关注，"
       "这样「我应该多关心团队」这句模糊的自我要求，就能变成今天就能做的三件事。", False)])
P()
RICH([("功能说明。", True),
      ("系统依据每个联系人最近一次互动距今的时间间隔，将其归入"
       "「高优先级」「需关注」「已安排」「关系正常」四类，"
       "并在首页与洞察页以清单形式呈现，附上可解释的原因"
       "（如「117 天未关怀，建议安排沟通」）。用户可直接从清单进入安排流程。", False)])
P()
RICH([("相关理论。", True)])
BULLET("人类能维持稳定社会关系的数量存在认知上限（Dunbar 数，约 150）。"
       "职场中需要维护的关系数量常接近甚至超过这一上限，"
       "因此「谁该被关心」不能依赖记忆，必须外化为系统状态。", "认知负荷与关系容量上限：")
BULLET("结构洞理论指出，跨越不同群体的弱连接往往带来更高的信息价值，"
       "但弱连接恰恰最容易被遗忘。这支持了本产品「对长期未联系者主动提示」的设计取向。",
       "社会资本理论：")
BULLET("[状态判定] 与 [动作触发] 分离。系统只负责告诉你「谁需要关注」，"
       "不代替你决定说什么——这既降低系统的责任边界，"
       "也避免自动化关怀带来的冒犯感。", "提醒系统设计：")

H("4.3 核心功能三：主动提醒与本地通知", level=2)
RICH([("用户故事。", True),
      ("作为一名同时推进多条招聘线的 HR，我想在面试开始前收到提醒，"
       "这样我真的会去做那段关系维护，而不是又一次错过。", False)])
P()
RICH([("功能说明。", True),
      ("为每条日程设置提醒提前量（默认 10 分钟），由系统在设备本地排期并推送通知；"
       "点击通知直接跳转到对应日程。通知文案自动生成"
       "（如「10 分钟后：与张伟的面试」），并对超长姓名做截断以避免排版溢出。", False)])
P()
RICH([("相关理论。", True)])
BULLET("在固定时间间隔重复某一行为，有助于将其转化为长期习惯。"
       "提醒的价值不在于「通知」本身，而在于把偶发的关怀行为固化为稳定习惯。",
       "间隔重复的启发：")
BULLET("提醒的有效性与频率并非线性关系。过度提醒会导致用户关闭通知权限，"
       "而通知一旦被关闭，本产品的核心价值（主动提醒）即完全失效。"
       "因此我们把「不在新手引导阶段申请通知权限」作为一条硬性设计约定，"
       "权限请求只在用户真正需要它时出现（保存带提醒的日程之后、或主动打开提醒开关时）。",
       "通知疲劳与权限心理学：")

H("4.4 其他核心功能", level=2)
TABLE(
    ["功能", "用户故事", "要点"],
    [
        ["关怀邮件草稿",
         "作为一个要联系某人的人，我想要一封已经写好的草稿，这样我只需要改几个字就能发出去。",
         "基于联系人资料与日程内容生成，降低「维护动作」本身的成本"],
        ["CSV 批量导入",
         "作为刚接手新团队的人，我想粘贴 CSV 一次性导入名单，这样不用一个个手动录入。",
         "解决冷启动；否则新用户面对空名册会直接流失"],
        ["联系人重名消歧",
         "当我说的人名匹配到多个联系人时，我希望系统问我选哪一个，这样不会把日程挂到错误的人身上。",
         "语音交互中最典型的失败模式，必须显式处理而不是静默猜测"],
        ["关系洞察",
         "作为用户，我想看到关系状态的分布，这样我能判断自己这段时间的维护是否均衡。",
         "把「看不见」变成「看得见」，是产品价值的来源"],
    ],
    widths=[2.6, 7.4, 5.5],
)

doc.add_page_break()

# ================================================================ 5
H("5. User Interface Design", level=1)
P("本章为界面设计稿。所有截图均取自实际运行的 Android 版本"
  "（Pixel 3a / Android 15），未做任何修饰或拼接。"
  "内容既包含稳态页面，也包含交互过程中的中间状态"
  "——因为本产品的价值主要体现在交互流程中，而不只是静态页面。")

# --- 5.1
H("5.1 认证与新手引导", level=2)
P("首次使用需要完成「了解价值 → 建立名册」的引导。"
  "这一段的转化质量直接决定用户能否进入核心价值，因此把它作为独立的界面设计对象。")
SHOT("a1-login-empty.png", "图 1  登录页：仅保留品牌、一句话价值主张与两个输入项，降低首次进入的认知负担", 5.2)
SHOT("a2-login-error.png", "图 2  登录校验失败：错误以表单内联方式提示，不弹出阻断式对话框", 5.2)
SHOT("a3-register.png", "图 3  注册页：四字段一次性完成，避免分步注册造成的流失", 5.2)
SHOT_ROW([
    ("b1-onboarding.png", "图 4  引导一：建立人才名册"),
    ("b2-onboarding.png", "图 5  引导二：查看关系温度"),
    ("b3-onboarding.png", "图 6  引导三：用语音安排互动"),
], 4.3)

# --- 5.2
H("5.2 空状态设计", level=2)
P("新用户第一次进入时没有任何数据。空状态是最容易被忽视、"
  "却对留存影响最大的界面，因此为每个主页面单独设计。")
SHOT_ROW([
    ("c1-home-empty.png", "图 7  首页空状态：四个统计归零，并明确指向「添加联系人」"),
    ("c2-contacts-empty.png", "图 8  名册空状态：直接给出添加入口，而不是仅显示「暂无数据」"),
], 4.4)
SHOT_ROW([
    ("c3-insights-empty.png", "图 9  洞察空状态：保留统计框架，让用户预期未来会看到什么"),
    ("c4-calendar-empty.png", "图 10  日程空状态：说明可用语音创建，引导核心功能"),
], 4.4)

# --- 5.3
H("5.3 首页：关系概览与今日安排", level=2)
SHOT("e1-home.png", "图 11  首页：关系概览四个数字、今日安排、需要关注的人、快捷操作", 5.6)
BULLET("关系概览用四个数字回答「我的关系整体健康吗」，点击可跳转洞察页。")
BULLET("「需要关注的人」直接给出姓名、状态标签与原因，把模糊意愿转化为可执行清单。")
BULLET("快捷操作提供「新建日程 / 添加联系人 / 语音安排」三个高频入口，"
       "其中语音入口用蓝色实心做视觉强调，引导用户形成语音优先的使用习惯。")
BULLET("底部四项主 Tab（首页 / 日程 / 名册 / 洞察），语音悬浮按钮固定右下，"
       "保证任何页面都能一键开始语音输入。")

# --- 5.4
H("5.4 日程与日历视图", level=2)
SHOT("e2-calendar.png", "图 12  日程页：按日分组，卡片含类型标签、标题、时间段与提醒设置", 5.6)
SHOT("d3-event-drawer-empty.png", "图 13  新建日程抽屉（空表单）：必填项以红色星号标注", 5.6)
SHOT("d4-event-drawer-filled.png", "图 14  新建日程抽屉（已填写）：日期与时间分离为两个输入框，"
                                   "减少移动端日期选择器的误操作", 5.6)
SHOT("j1-event-actions.png", "图 15  日程卡片的更多操作：编辑与删除收纳在菜单中，"
                             "避免主界面上出现破坏性按钮", 5.6)
BULLET("支持「关怀 / 本月」视图切换，右侧箭头切换月份；当天以红点与日期文字标注。")
BULLET("设计取舍：语音悬浮按钮在日程页与助手页隐藏，避免遮挡日历最后一行内容。")
BULLET("「关联联系人」为可选项——允许创建无关联日程，"
       "避免用户因为「还没建联系人」而无法记录待办。")

# --- 5.5
H("5.5 人才名册与联系人详情", level=2)
SHOT("e3-contacts.png", "图 16  名册页：搜索框 + 分组筛选 + 联系人卡片（含关系状态标签）", 5.6)
SHOT("d1-contact-form.png", "图 17  新建联系人表单：姓名与邮箱为主，部门与岗位用于后续分组", 5.6)
SHOT("d2-contact-form-filled.png", "图 18  新建联系人表单（已填写）", 5.6)
SHOT("f2-contact-timeline.png", "图 19  联系人详情：头像、组织信息、关系状态与三个主操作；"
                                "下方互动时间线按时间倒序展示历史互动（日期 + 类型标签）", 5.6)
SHOT("f3-contact-edit.png", "图 20  编辑资料浮层：从详情页就地弹出，不跳转新页面，保持上下文", 5.6)
BULLET("名册卡片直接展示关系状态（如「高优先级 · 117 天未沟通」），"
       "用户无需进入详情即可判断是否需要行动。")
BULLET("关系状态给出可解释的原因（如「最近 5 天内有互动」），而不是只给一个分数。")
BULLET("分组标签「全部 / 员工 / 候选人」对应职场关系的两类主要身份。")
BULLET("「粘贴 CSV」以标签形式与筛选并列，降低批量导入的发现成本。")

# --- 5.6
H("5.6 关系洞察", level=2)
SHOT("e4-insights.png", "图 21  洞察页：四象限统计概览 + 按状态分组的联系人清单", 5.6)
BULLET("四象限用色彩编码（红=高优先级、橙=需关注、蓝=已安排、绿=正常），"
       "配色同时承担语义，便于快速判断。")
BULLET("每个分组下方直接列出联系人与原因，并提供进入安排的入口，"
       "使「看到问题」与「采取行动」之间不产生断点。")

# --- 5.7
H("5.7 语音助手：核心交互流程", level=2)
P("这是产品的核心交互界面，因此单独呈现完整的交互过程，而不只是静态页面。")
SHOT("g1-assistant-idle.png", "图 22  助手初始态：对话区为空，底部提示「点击麦克风，说出联系人、时间和关怀事项」", 5.6)
SHOT("g2-assistant-suggestion.png", "图 23  选择示例说法后：输入框中出现建议句式，用户可直接修改后发送", 5.6)
SHOT("g3-assistant-recording.png", "图 24  录音中：麦克风按钮切换为录音态，文案变为「正在录音，再次点击停止...」", 5.6)
SHOT("g4-assistant-result.png", "图 25  识别与执行结果：显示识别出的文本、执行动作与创建结果，"
                                 "并进入日程页显示新建日程", 5.6)
BULLET("空状态给出四个典型说法示例（「1:1 安排1对1」「HR 面试跟进」等），"
       "解决「我该怎么跟它说话」这一新交互方式固有的学习成本。")
BULLET("麦克风按钮尺寸显著大于其他操作，是页面唯一的强视觉焦点。")
BULLET("对话以气泡形式保留历史，让用户可以回看自己说过什么、系统识别成了什么"
       "——识别错误时这一点尤其重要。")

# --- 5.8
H("5.8 邮件编辑器", level=2)
SHOT("h1-mail-editor.png", "图 26  邮件编辑器：主题与正文可编辑，顶部提供「保存草稿」", 5.6)
SHOT("h2-mail-preview.png", "图 27  预览态：按关怀邮件模板渲染最终效果，并提供刷新预览入口", 5.6)
SHOT("h3-mail-unsaved-confirm.png", "图 28  未保存保护：正文有修改时返回会二次确认，"
                                     "避免误触丢失内容", 5.6)

# --- 5.9
H("5.9 设置与权限", level=2)
SHOT("i1-settings.png", "图 29  设置页：账户信息、日程提醒开关与提前量设置", 5.6)
SHOT("i2-settings-bottom.png", "图 30  设置页底部：关怀频率、关于信息与退出登录", 5.6)
SHOT("j3-permission-notification.png", "图 31  通知权限申请：仅在用户主动打开提醒开关后触发，"
                                       "不在新手引导阶段打扰用户", 5.6)
SHOT("j4-permission-microphone.png", "图 32  麦克风权限申请：由点击录音按钮触发，"
                                      "并提供「仅在使用时允许」选项", 5.6)
BULLET("权限申请时机是本产品刻意的设计决策：把权限请求放在用户真正需要它的时刻。"
       "过早申请会导致用户习惯性拒绝，而权限一旦被拒绝，相关功能即完全失效。")

# --- 5.10
H("5.10 通知与异常反馈", level=2)
SHOT("j2-notification-shade.png", "图 33  系统通知栏中的提醒：图标、应用名与提醒文案", 5.6)
SHOT("j5-permission-denied-feedback.png", "图 34  权限被拒后的反馈：给出可理解的说明与解决路径，"
                                          "而不是静默失败", 5.6)
SHOT("k1-long-text.png", "图 35  长文本适配：超长姓名（15 字含分隔符）与部门在列表中省略号截断，"
                         "不产生横向滚动", 5.6)

P()
RICH([("界面设计原则小结：", True)])
BULLET("所有需要输入的页面都必须有对应的语音路径；没有语音路径的表单视为次要功能。", "语音优先：")
BULLET("关系状态不藏在详情页里，而是在列表卡片上直接可见。", "信息前置：")
BULLET("「看到问题」与「采取行动」之间的跳转不超过一次点击。", "闭环无断点：")
BULLET("空状态、异常态、权限态都要单独设计，不能只设计顺利路径。", "状态完整：")
BULLET("触控目标不小于 40px；底部导航固定在安全区内，不与系统手势冲突。", "移动端可达性：")

doc.add_page_break()

# ================================================================ 6
H("6. Market Research with Competitive Analysis", level=1)

H("6.1 市场背景", level=2)
P("职场关系维护长期依赖个人习惯，而非工具。现有工具可以分成五类，"
  "但没有一类真正解决「关系会静默衰减」这一问题。"
  "值得注意的是，这些工具并非没有意识到关系管理的重要性，"
  "而是都没有解决同一个致命问题：数据录入的摩擦过高。")

H("6.2 竞品分析", level=2)
TABLE(
    ["竞品类别", "代表产品", "优势", "局限（我们的机会）"],
    [
        ["系统通讯录", "Android / iOS 通讯录",
         "人人都有，零安装成本",
         "只有静态信息，不提醒维护关系；无互动历史"],
        ["日历应用", "Google Calendar、系统日历",
         "时间管理成熟，生态完善",
         "只知道「有什么会」，不知道「和谁多久没联系」；无关系维度"],
        ["即时通讯", "微信、企业微信、Slack",
         "沟通在这里真实发生",
         "本质是沟通工具而非关系管理工具；不记录、不提醒、不统计关系状态"],
        ["CRM 系统", "Salesforce、HubSpot、纷享销客",
         "关系管理能力强大，流程完善",
         "面向销售团队，重且贵；要求大量手工录入，销售人员普遍敷衍填写"],
        ["人脉管理 App", "各类名片 / 人脉管理工具",
         "概念与需求契合",
         "依赖手动记录，录入体验差，用户通常使用三次后即放弃"],
    ],
    widths=[2.4, 3.6, 3.6, 6.0],
)

H("6.3 我们的差异点", level=2)
NUMBER("这是本产品唯一真正的差异点，也是其他工具没能解决的关键问题。"
       "竞品不是没想到做关系管理，而是没能把「记录一段互动」的成本降到用户愿意坚持的水平。"
       "语音把这个成本从约 30 秒压缩到约 3 秒。", "把录入摩擦降到接近零：")
NUMBER("麦克风权限、后台通知、系统级提醒，这些恰恰是「主动提醒」原则的前提。"
       "纯网页方案会直接失去产品的一半价值。", "原生移动优先，而非网页：")
NUMBER("只做关怀，不做销售。这带来两个好处：面向个人而非团队，隐私压力小、决策链短；"
       "概念简单，不需要培训就能理解产品在做什么。", "聚焦职场关怀，不做 CRM：")
NUMBER("大部分工具止步于「帮你记」；我们回答的是「今天该联系谁」，"
       "并直接给出可执行的清单与入口。", "从记录工具升级为行动建议：")

H("6.4 护城河并不深（诚实评估）", level=2)
P("作为提案报告，有必要明确指出本产品的竞争壁垒是有限的："
  "语音识别是公开的云服务能力，关系状态判定是可被复制的规则，"
  "邮件草稿生成也已高度同质化。真正可能形成壁垒的只有两点：")
BULLET("语音在真实场景（嘈杂环境、方言口音、用户说错话）下的鲁棒性。"
       "这直接决定用户是否信任这个产品。一次严重的误识别"
       "（例如把日程挂到错误的人身上）比十次成功更影响留存。", "交互打磨的细致程度：")
BULLET("「117 天未沟通算需要关注」这类阈值，在不同关系类型下差异极大："
       "直属下属可能两周，跨部门同事可能半年。统一阈值会既漏报又误报，"
       "而误报会迅速消耗用户耐心。这需要真实用户数据来校准。", "关系判定模型的准确度：")

H("6.5 主要产品风险", level=2)
TABLE(
    ["风险", "说明", "应对方向"],
    [
        ["语音鲁棒性决定生死",
         "嘈杂环境、口音、复杂长句下的识别错误会使用户彻底失去信任",
         "重名时主动询问、失败时明确提示而非静默失败、支持取消与改期"],
        ["统一阈值可能不成立",
         "不同关系类型的合理联系频率差异极大，误报会消耗耐心",
         "按关系类型设定不同阈值，并允许用户调整"],
        ["冷启动摩擦力大",
         "新用户看到空名册很可能直接退出",
         "强化 CSV 导入引导；名册为空时提示先添加联系人"],
        ["隐私敏感度高",
         "「多久没联系」属于敏感职场数据，用户担心数据用途",
         "数据严格按用户账号隔离；明确不作任何评估用途"],
        ["提醒容易变成打扰",
         "提醒过于频繁会使用户关闭通知，产品核心价值随之失效",
         "严格限制权限申请时机；提醒频率可配置"],
    ],
    widths=[2.8, 5.8, 7.0],
)

H("6.6 如何验证这些判断", level=2)
TABLE(
    ["待验证假设", "验证方式"],
    [
        ["语音真的比手动输入省事", "对比同一条日程的语音创建与手动创建耗时"],
        ["「需要关注」清单真的有人用", "洞察页查看率；从洞察页产生日程的转化率"],
        ["提醒会被行动，而不是被关掉", "通知点击率；通知权限的关闭率"],
        ["关系阈值判定是否合理", "用户对「高优先级」标记的接受度（是否被频繁忽略）"],
    ],
    widths=[6.0, 9.5],
)
P()
RICH([("其中最关键的一项指标是「从洞察页产生关怀日程的比例」。", True),
      ("如果用户看了「需要关注的人」却从不采取行动，"
       "那么本产品就只是一个有趣的语音演示，而不是一个真正解决问题的产品。", False)])

# ================================================================ 7
P()
H("7. 结语", level=1)
P("职场关系的衰减是静默的，而人们不是不在乎，是记不住、也懒得记。"
  "TalentMate 伴贤用语音把记录成本降到接近零，主动告诉你今天该关心谁，"
  "并在日程开始前提醒你——让「维护关系」这件事第一次变得可持续。")
RICH([("产品边界：", True), ("我们只帮你记得和安排，那句问候仍然要你自己说。", False)])

doc.save(OUT_DOCX)
print("DOCX 已生成:", OUT_DOCX)
print("大小: %.1f KB" % (os.path.getsize(OUT_DOCX) / 1024))
