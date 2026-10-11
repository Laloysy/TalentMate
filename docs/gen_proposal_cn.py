# -*- coding: utf-8 -*-
"""生成提案报告的中文版。

说明：这不是英文版的逐句直译，而是用中文重新组织表达。
同一套事实、同一批截图、同样的章节顺序，但论述方式按中文习惯重写，
避免翻译腔。章节顺序仍严格对齐课程模板：

  1. App Name
  2. Summary of the Project
  3. Preliminary List of Functional Requirements
  4. Major Functions of the Proposed App and the Related Theory
  5. User Interface Design
  6. Market Research with Competitive Analysis
"""
import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

REPO = r"D:\学习\我爱学习\前端开发\TalentMate"
SHOTS = os.path.join(REPO, "docs", "proposal-shots")
OUT_DOCX = os.path.join(REPO, "docs", "60249104_CHENYANGZHANG_TalentMate_IndProposalReport_CN.docx")

STUDENT_ID = "60249104"
STUDENT_NAME = "张辰阳"
CN = "微软雅黑"

doc = Document()

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), CN)
normal.paragraph_format.space_after = Pt(4)
normal.paragraph_format.line_spacing = 1.3

for i, (size, bold) in enumerate([(18, True), (14, True), (12, True), (11, True)], start=1):
    s = doc.styles[f"Heading {i}"]
    s.font.name = "Calibri"
    s.font.size = Pt(size)
    s.font.bold = bold
    s.font.color.rgb = RGBColor(0x1F, 0x2A, 0x37)
    s._element.rPr.rFonts.set(qn("w:eastAsia"), CN)
    s.paragraph_format.space_before = Pt(12 if i <= 2 else 8)
    s.paragraph_format.space_after = Pt(6)

for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)


def _r(run):
    run.font.name = "Calibri"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), CN)
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
        P(f"[缺少截图：{filename}]", italic=True)
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


# ================================================================== 封面
t = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(t.add_run("TalentMate 伴贤")).bold = True
t.runs[0].font.size = Pt(26)

s = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(s.add_run("用一句话，把该维护的关系维护起来")).font.size = Pt(12)
s.runs[0].font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

P()
info = P(align=WD_ALIGN_PARAGRAPH.CENTER)
_r(info.add_run(f"个人提案报告\n{STUDENT_ID}  {STUDENT_NAME}")).font.size = Pt(11)
P()

# ================================================================== 1
H("1. App Name", level=1)
RICH([("应用名称：", True), ("TalentMate 伴贤", False)])
RICH([("一句话定位：", True),
      ("帮你记住那些该维护的关系，并把「记一笔」这件事压缩成说一句话。", False)])
RICH([("运行平台：", True),
      ("Android 原生应用（最低支持 Android 7.0 / API 24，开发与测试环境为 Android 15）", False)])
P()

# ================================================================== 2
H("2. Summary of the Project", level=1)

H("2.1 要解决的问题", level=2)
P("职场关系的退化是没有声响的。一段关系从「还不错」走到「好久没联系」，"
  "中间不会跳出任何提示——没有报错，没有到期日，也没有人告诉你"
  "「你上次和这个人说话已经是 117 天前了」。你往往是在需要对方的那一刻"
  "才发现：想请他内推、想调个资源、想请他帮个忙，或者只是想知道他为什么想走。")
P("但问题的根源并不是「大家不在乎」。真正麻烦的是两件事叠在一起：")
BULLET("关系的好坏是隐性的，而人脑并不擅长同时盯住几十上百条关系的退化曲线；", "一是看不见——")
BULLET("就算看见了，要把「跟谁、什么时候、聊了什么、下次何时跟进」记下来，"
       "这个动作的门槛高到几乎没人能长期坚持。", "二是懒得记——")
RICH([("第二点才是关键。", True),
      ("市面上的关系管理工具，最后几乎都死在同一个地方：没人愿意录数据。"
       "CRM 让销售填表单，销售就敷衍地填；人脉 App 让用户手工记笔记，"
       "用户用三次就再也不打开了。而语音是目前唯一能把「记一笔」的成本压到接近零的方式——"
       "面试刚结束，走出会议室说一句「下周三提醒我跟进张伟的 offer」，三秒搞定，"
       "不用打字、不用翻联系人、不用挑日期。", False)])
P("这也解释了为什么这件事现在才做得了：语音识别是近两年才便宜、准确到足以承载交互的。"
  "再早两年，这个产品在技术上根本立不住。", italic=True)

H("2.2 目标用户", level=2)
RICH([("主要用户：", True),
      ("带 5–20 人团队的中基层管理者、HR 和招聘。他们的工作成果直接取决于关系质量，"
       "而关系质量恰恰不被任何系统度量；他们同时维护着 20 到 200 条工作关系，"
       "这个量级已经超出记忆能可靠覆盖的范围。他们已经装了日历和通讯录，"
       "但两者互不相通——日历知道周三 15:00 有会，却不知道你和这个人已经 117 天没说话了。", False)])
RICH([("次要用户：", True),
      ("被导师或上级提醒过「要多跟人保持联系」，但手里没有任何工具的人。"
       "他们的困难不在于不知道该联系，而在于不知道该联系谁、什么时候联系。", False)])
RICH([("明确不服务的对象：", True),
      ("需要销售漏斗管理的销售团队（他们要的是 CRM）、只想存电话号码的人，"
       "以及把这里当成社交平台的人。", False)])

H("2.3 产品愿景", level=2)
RICH([("让维护职场关系的成本低到不需要靠意志力。", True)], align=WD_ALIGN_PARAGRAPH.CENTER)
P("这句话拆开，是三条设计原则：")
NUMBER("每一个需要输入的功能，都必须能用语音走完。这不是「加一个语音输入框」，"
       "而是整个信息架构围着语音重新设计。也正因为如此，产品必须是原生 App 而不是网页——"
       "麦克风权限、后台通知、系统级行为，在浏览器里全都做不到。", "零门槛录入是产品的命门。")
NUMBER("产品的价值不在于用户想起来打开它，而在于用户忘了的时候它会来找你。"
       "所以本地通知是核心功能，不是可有可无的配件。", "主动提醒，而不是被动查询。")
NUMBER("我们只做三件事：让你看见哪些关系需要打理、帮你记住承诺过的跟进、"
       "替你省掉起草消息的力气。真正那句寒暄，仍然要你自己开口——"
       "一旦由 AI 代发，关怀就变成了骚扰。", "替你记，但不替你做决定。")

H("2.4 项目范围", level=2)
RICH([("纳入范围：", True)])
BULLET("语音创建、查询、取消与改期关怀日程（产品的核心差异点）")
BULLET("联系人名册，区分员工与候选人")
BULLET("关系状态判定（高优先级 / 需关注 / 已安排 / 关系正常）")
BULLET("关怀日历与月度视图")
BULLET("提醒设置与本地通知推送")
BULLET("关怀邮件草稿自动生成")
BULLET("关系洞察：状态分布统计，以及一份可直接执行的「需要关注的人」清单")
BULLET("粘贴 CSV 批量导入联系人（解决冷启动）")
P()
RICH([("明确不做，以及为什么：", True)])
TABLE(
    ["不做", "原因"],
    [
        ["销售漏斗 / 商机 / 合同管理", "那是 CRM 的地盘。真做了，产品就变成「又一个 CRM」，聚焦也就没了"],
        ["社交功能（动态、点赞、加好友）", "职场关系是私密的，一旦公开化，用户立刻就不愿意用了"],
        ["团队协作 / 共享名册", "隐私与权限的复杂度极高，而且不是核心痛点"],
        ["完整的邮件客户端", "我们只解决「起草」这一段，收发交给专业工具"],
        ["由 AI 自动发送消息", "这是一条伦理边界：关怀不能被自动化代劳"],
        ["多端实时同步", "工程量很大，但对「一个人维护自己的关系」这个核心场景收益有限"],
        ["第三方日历双向同步", "有价值但非必需，各平台差异大，容易把进度拖垮"],
        ["数据分析 / 报表导出", "面向个人的效率工具不需要 BI"],
    ],
    widths=[5.5, 10.0],
)
P()
RICH([("取舍标准：", True),
      ("如果一个功能不能服务于「降低关系维护的门槛」，就不做。宁可窄而深，不要宽而浅。", False)])

doc.add_page_break()

# ================================================================== 3
H("3. Preliminary List of Functional Requirements", level=1)
P("优先级定义：P0 是产品能成立的必要条件；P1 支撑主流程；P2 属于体验完善。")
TABLE(
    ["编号", "功能模块", "功能说明", "优先级"],
    [
        ["FR-01", "语音识别", "采集麦克风音频并转为文本", "P0"],
        ["FR-02", "意图解析", "从自然语言中抽取意图类型、联系人、时间与事项", "P0"],
        ["FR-03", "语音建日程", "一句话创建关怀日程并设置提醒", "P0"],
        ["FR-04", "联系人匹配", "把语音中的人名对上名册；重名时请用户确认", "P0"],
        ["FR-05", "关系状态判定", "依据互动间隔推导关系状态", "P0"],
        ["FR-06", "关注清单", "列出需要关注的联系人，并给出可解释的原因", "P0"],
        ["FR-07", "本地通知", "按设定的提前量推送日程提醒", "P0"],
        ["FR-08", "联系人管理", "联系人的增删改查（姓名 / 邮箱 / 部门 / 岗位）", "P0"],
        ["FR-09", "日程管理", "手动创建、编辑、删除关怀日程", "P0"],
        ["FR-10", "用户认证", "注册、登录、登录态维持与过期处理", "P0"],
        ["FR-11", "日历视图", "按月展示日程，支持切换月份与视图模式", "P1"],
        ["FR-12", "联系人详情", "资料、关系状态与互动时间线", "P1"],
        ["FR-13", "邮件草稿", "依据日程与联系人生成可编辑、可预览的关怀草稿", "P1"],
        ["FR-14", "CSV 导入", "粘贴 CSV 批量导入联系人", "P1"],
        ["FR-15", "语音查询", "用语音查询某段时间的安排", "P1"],
        ["FR-16", "语音取消 / 改期", "用语音取消或调整已有日程", "P1"],
        ["FR-17", "邮件发送", "通过 SMTP 发出关怀邮件", "P1"],
        ["FR-18", "关系洞察", "关系状态分布统计与关怀概览", "P1"],
        ["FR-19", "权限处理", "麦克风与通知的运行时权限申请与降级处理", "P1"],
        ["FR-20", "异常反馈", "网络或识别失败时给出看得懂的提示，而不是静默失败", "P1"],
        ["FR-21", "未保存保护", "表单有未保存修改时，返回前二次确认", "P2"],
        ["FR-22", "新手引导", "首次使用时说明价值并引导第一组动作", "P2"],
        ["FR-23", "长文本适配", "过长的姓名与部门优雅截断，不破坏布局", "P2"],
    ],
    widths=[1.5, 2.7, 8.3, 1.6],
)

doc.add_page_break()

# ================================================================== 4
H("4. Major Functions of the Proposed App and the Related Theory", level=1)
P("本章说明三个核心功能、它们背后的用户故事，以及支撑这些设计的相关理论。"
  "所描述的功能均已在 Android 端实现并经过验证。")

H("4.1 核心功能一：用语音创建关怀日程", level=2)
RICH([("用户故事。", True),
      ("作为一名刚结束面试的招聘专员，我想用一句话记下「下周三跟进张伟的 offer」，"
       "这样我就不必打开表单去填六项内容——因为在我填完之前，"
       "这件事早就被下一件工作从脑子里挤出去了。", False)])
P()
RICH([("功能说明。", True),
      ("用户点一下麦克风，说一句话。系统随后依次完成：语音识别、意图解析、联系人匹配、"
       "创建日程并设置提醒、生成邮件草稿、反馈结果。例如说「明天下午三点安排和张伟的一对一沟通」，"
       "系统会建好次日下午 15:00 的日程、绑定联系人张伟，并生成一封邮件草稿。", False)])
P()
RICH([("相关理论。", True)])
BULLET("语音是比键盘带宽更高的输入通道，尤其在双手被占用、"
       "或者不方便在公共场合打一长串字的移动场景里。这里的重点不是「语音更新鲜」，"
       "而是它把一条记录的输入成本从大约 30 秒压到约 3 秒——"
       "刚好跨过了用户愿意长期坚持的那条线。", "输入效率。")
BULLET("关于自然语言交互的研究表明，用户对系统的信任度取决于"
       "「出错之后好不好收拾」，而不是错误率本身。"
       "因此我们把「重名时主动询问」「识别失败时明确说明」「支持语音取消与改期」"
       "当作必需能力，而不是锦上添花。", "对话式交互的容错设计。")
BULLET("把非结构化的自然语言映射到结构化的槽位上。本产品的槽位是："
       "意图类型、联系人、开始时间、事项标题、提醒提前量。"
       "这是整个功能里最难、也最容易出错的一环。", "意图识别与槽位填充。")

H("4.2 核心功能二：关系状态判定与「需要关注的人」", level=2)
RICH([("用户故事。", True),
      ("作为一名带十二个人的研发经理，我想知道到底具体是哪几个人需要我关心，"
       "这样「我应该多关心团队」这句模糊的自我要求，"
       "才能变成今天下班前就能做完的三件事。", False)])
P()
RICH([("功能说明。", True),
      ("系统根据每个联系人距最近一次互动过去了多久，"
       "把他们归入高优先级、需关注、已安排、关系正常四类，"
       "并在首页与洞察页以清单形式呈现，同时给出可解释的原因"
       "（例如「117 天未关怀，建议安排沟通」）。用户可以从这份清单直接进入安排流程。", False)])
P()
RICH([("相关理论。", True)])
BULLET("一个人能维持的稳定社会关系数量存在认知上限（Dunbar 数，约 150）。"
       "而职场中需要维护的关系数量常常逼近甚至超过这个上限，"
       "所以「谁值得被关心」这件事不能交给记忆，必须外化成系统状态。",
       "认知负荷与关系容量上限。")
BULLET("结构洞理论认为，跨越不同群体的弱连接往往携带更高的信息价值，"
       "而弱连接恰恰是最容易被忘掉的那一类。"
       "这支持了我们「对长期未联系的人主动提示」这一设计取向。", "社会资本。")
BULLET("系统只负责告诉你谁需要关注，不替你决定该说什么。"
       "这样既收窄了系统的责任边界，也避免了自动化关怀带来的冒犯感。",
       "状态判定与动作触发相分离。")

H("4.3 核心功能三：用本地通知做主动提醒", level=2)
RICH([("用户故事。", True),
      ("作为一名同时推进多条招聘线的 HR，我想在面试开始前收到提醒，"
       "这样我这次真的会去维护那段关系，而不是又一次错过。", False)])
P()
RICH([("功能说明。", True),
      ("每条日程都带一个提醒提前量（默认 10 分钟），由系统在设备本地排期并推送通知，"
       "点通知可以直接跳到对应日程。通知文案自动生成（例如「10 分钟后：与张伟的面试」），"
       "过长的姓名会被截断，避免排版溢出。", False)])
P()
RICH([("相关理论。", True)])
BULLET("在固定间隔上重复某个行为，有助于把它固化成长习惯。"
       "提醒的价值不在这条通知本身，而在于它把偶发的关怀动作变成稳定的习惯。",
       "间隔重复的启发。")
BULLET("提醒的有效性和频率并不是线性关系。提醒太密，用户就会去关通知；"
       "而通知一旦被关掉，这个产品的核心价值也就没了。"
       "所以我们把「绝不在新手引导阶段申请通知权限」定为一条硬规矩："
       "权限请求只在用户真正需要它的时刻出现——保存带提醒的日程之后，"
       "或者用户主动打开提醒开关的时候。", "通知疲劳与权限心理。")

H("4.4 其他核心功能", level=2)
TABLE(
    ["功能", "用户故事", "要点"],
    [
        ["关怀邮件草稿",
         "作为一个要主动联系别人的人，我希望草稿已经写好了，这样我只要改几个字就能发出去。",
         "依据联系人资料与日程内容生成，降低「维护」这个动作本身的成本"],
        ["CSV 批量导入",
         "作为刚接手一个新团队的人，我希望粘贴一次 CSV 就把名单导进来，不用一个个录。",
         "解决冷启动；没有它，新用户面对空名册会直接流失"],
        ["联系人重名消歧",
         "当我说的人名对上好几个联系人时，我希望系统问我是哪一个，别把日程挂到错误的人身上。",
         "语音交互里最典型的失败模式，必须显式处理，不能靠猜"],
        ["关系洞察",
         "作为用户，我想看到关系状态的分布，这样我能判断最近这段时间我的关注是否均衡。",
         "把看不见的变成看得见的，这正是产品价值的来源"],
    ],
    widths=[2.6, 7.4, 5.5],
)

doc.add_page_break()

# ================================================================== 5
H("5. User Interface Design", level=1)
P("本章呈现界面设计。所有截图都取自实际运行的 Android 版本（Pixel 3a / Android 15），"
  "未经修饰或拼接。其中既包含稳态页面，也包含交互过程中的中间状态——"
  "因为这款产品的价值主要体现在交互流程里，而不只是静态页面上。")

H("5.1 登录与新手引导", level=2)
P("首次使用需要走完一小段「先说明价值、再建立名册」的引导。"
  "这一段的转化质量，直接决定用户能不能走到核心价值，因此把它单独当作设计对象。")
SHOT("a1-login-empty.png", "图 1  登录页：只保留品牌、一句话价值主张和两个输入项，降低首次进入的门槛", 5.2)
SHOT("a2-login-error.png", "图 2  登录校验失败：错误就地内联显示，不用阻断式弹窗打断用户", 5.2)
SHOT("a3-register.png", "图 3  注册页：四个字段一步完成，避免分步注册造成的流失", 5.2)
SHOT_ROW([
    ("b1-onboarding.png", "图 4  引导一：先建立人才名册"),
    ("b2-onboarding.png", "图 5  引导二：查看关系温度"),
    ("b3-onboarding.png", "图 6  引导三：用语音安排互动"),
], 4.3)

H("5.2 空状态设计", level=2)
P("新用户进来时手上一点数据都没有。空状态是最容易被忽略、"
  "却又最影响留存的界面，所以每个主页面都单独设计过。")
SHOT_ROW([
    ("c1-home-empty.png", "图 7  首页空状态：统计归零，并明确指向「添加联系人」"),
    ("c2-contacts-empty.png", "图 8  名册空状态：直接给添加入口，而不是只写一句「暂无数据」"),
], 4.4)
SHOT_ROW([
    ("c3-insights-empty.png", "图 9  洞察空状态：保留统计骨架，让用户心里有数之后会看到什么"),
    ("c4-calendar-empty.png", "图 10  日程空状态：说明可以用语音创建，把用户引向核心功能"),
], 4.4)

H("5.3 首页：关系概览与今日安排", level=2)
SHOT("e1-home.png", "图 11  首页：四个关系统计数字、今日安排、需要关注的人，以及快捷操作", 5.6)
BULLET("四个统计数字回答的是「我的关系整体上还健康吗」，点进去就是洞察页。")
BULLET("「需要关注的人」直接把姓名、状态标签和原因摆在卡片上，把模糊的念头变成能执行的清单。")
BULLET("快捷操作给出三个最高频的入口（新建日程 / 添加联系人 / 语音），"
       "其中语音入口用蓝色实心强调，引导用户养成语音优先的习惯。")
BULLET("底部四个主 Tab（首页 / 日程 / 名册 / 洞察），语音悬浮按钮固定在右下角，"
       "任何页面都能一键开始说话。")

H("5.4 日历与日程表单", level=2)
SHOT("e2-calendar.png", "图 12  日程页：按天分组，卡片上有类型标签、标题、时间段与提醒设置", 5.6)
SHOT("d3-event-drawer-empty.png", "图 13  新建日程抽屉（空表单）：必填项用红色星号标出", 5.6)
SHOT("d4-event-drawer-filled.png", "图 14  新建日程抽屉（已填写）：日期与时间拆成两个输入框，减少移动端日期选择器的误操作", 5.6)
SHOT("j1-event-actions.png", "图 15  日程卡片的更多操作：编辑与删除收进菜单里，不让破坏性操作出现在主界面上", 5.6)
BULLET("可以在「关怀 / 本月」之间切换视图，箭头用来翻月份，当天用红点和日期文字标出来。")
BULLET("一处设计取舍：语音悬浮按钮在日程页和助手页隐藏，免得挡住日历最后一行。")
BULLET("「关联联系人」是可选项——这是有意的，让还没建联系人的用户也能先记下待办。")

H("5.5 名册与联系人详情", level=2)
SHOT("e3-contacts.png", "图 16  名册页：搜索框、分组筛选，以及带关系状态标签的联系人卡片", 5.6)
SHOT("d1-contact-form.png", "图 17  新建联系人表单：以姓名和邮箱为主，部门与岗位供后续分组使用", 5.6)
SHOT("d2-contact-form-filled.png", "图 18  新建联系人表单（已填写）", 5.6)
SHOT("f2-contact-timeline.png", "图 19  联系人详情：头像、组织信息、关系状态与三个主操作，下方是互动时间线（按时间倒序，带日期与类型标签）", 5.6)
SHOT("f3-contact-edit.png", "图 20  编辑资料浮层：从详情页就地弹出，不跳新页面，保持上下文", 5.6)
BULLET("名册卡片上直接显示关系状态（例如「高优先级 · 117 天未沟通」），"
       "用户不进详情页就能判断要不要行动。")
BULLET("状态会附带可解释的原因（例如「最近 5 天内有互动」），而不是甩一个分数。")
BULLET("分组标签（全部 / 员工 / 候选人）对应职场关系里的两类主要身份。")
BULLET("「粘贴 CSV」和筛选标签并排放，让批量导入更容易被发现。")

H("5.6 关系洞察", level=2)
SHOT("e4-insights.png", "图 21  洞察页：四象限统计概览，加上按状态分组的联系人清单", 5.6)
BULLET("四个象限用颜色区分（红=高优先级、橙=需关注、蓝=已安排、绿=关系正常），"
       "颜色本身承载语义，扫一眼就能看懂。")
BULLET("每个分组下面直接列出联系人和原因，并给出进入安排的入口，"
       "让「看到问题」和「动手处理」之间不断链。")

H("5.7 语音助手：核心交互流程", level=2)
P("这是产品的核心交互界面，所以这里呈现完整的交互过程，而不是只放一张静态图。")
SHOT("g1-assistant-idle.png", "图 22  助手初始态：对话区为空，底部提示「点击麦克风，说出联系人、时间和关怀事项」", 5.6)
SHOT("g2-assistant-suggestion.png", "图 23  选了示例说法之后：输入框里出现建议句式，用户可以直接改完再发", 5.6)
SHOT("g3-assistant-recording.png", "图 24  录音中：麦克风按钮切成录音态，文案变成「正在录音，再次点击停止...」", 5.6)
SHOT("g4-assistant-result.png", "图 25  识别与执行结果：展示识别出的文本、执行的动作与创建结果，并跳到日程页显示新建的日程", 5.6)
BULLET("空状态给出四个典型说法（一个 1:1、一次 HR 面试跟进等），"
       "解决一种新交互方式天然带着的学习成本——「我该怎么跟它说话」。")
BULLET("麦克风按钮明显大于其他控件，是整屏唯一的强视觉焦点。")
BULLET("对话以气泡形式保留历史，用户能回看自己说过什么、系统听成了什么——"
       "识别出错时，这一点尤其重要。")

H("5.8 邮件编辑器", level=2)
SHOT("h1-mail-editor.png", "图 26  邮件编辑器：主题与正文均可编辑，顶部是「保存草稿」", 5.6)
SHOT("h2-mail-preview.png", "图 27  预览态：按关怀邮件模板渲染最终效果，并提供刷新预览入口", 5.6)
SHOT("h3-mail-unsaved-confirm.png", "图 28  未保存保护：正文改过之后返回会二次确认，避免误触丢内容", 5.6)

H("5.9 设置与权限", level=2)
SHOT("i1-settings.png", "图 29  设置页：账户信息、日程提醒开关与提前量设置", 5.6)
SHOT("i2-settings-bottom.png", "图 30  设置页底部：关怀频率、关于信息与退出登录", 5.6)
SHOT("j3-permission-notification.png", "图 31  通知权限申请：只在用户主动打开提醒开关之后触发，绝不在新手引导阶段打扰用户", 5.6)
SHOT("j4-permission-microphone.png", "图 32  麦克风权限申请：由点击录音按钮触发，并提供「仅在使用时允许」的选项", 5.6)
BULLET("权限申请的时机是刻意设计的：在用户真正需要这项能力的那一刻再问。"
       "问得太早，用户会习惯性地拒绝；而权限一旦被拒绝，对应功能也就彻底废了。")

H("5.10 通知、异常反馈与边界情况", level=2)
SHOT("j2-notification-shade.png", "图 33  系统通知栏里的提醒：图标、应用名与提醒文案", 5.6)
SHOT("j5-permission-denied-feedback.png", "图 34  权限被拒后的反馈：给出看得懂的说明和后续路径，而不是静默失败", 5.6)
SHOT("k1-long-text.png", "图 35  长文本适配：15 字超长姓名与长部门名以省略号截断，不产生横向滚动", 5.6)

P()
RICH([("界面设计原则小结：", True)])
BULLET("凡是需要输入的页面，都必须有语音通路；没有语音通路的表单，一律视为次要功能。", "语音优先：")
BULLET("关系状态直接长在列表卡片上，不藏在详情页里。", "信息前置：")
BULLET("从「看到问题」到「动手处理」，中间不超过一次点击。", "闭环不断链：")
BULLET("空状态、异常态、权限态都要单独设计，只做顺利路径是不够的。", "状态齐全：")
BULLET("触控目标不小于 40px，底部导航放在安全区内，不与系统手势打架。", "移动端可达性：")

doc.add_page_break()

# ================================================================== 6
H("6. Market Research with Competitive Analysis", level=1)

H("6.1 市场背景", level=2)
P("维护职场关系这件事，长期以来靠的是个人习惯，而不是工具。"
  "现有工具大致分五类，但没有一类真正解决了「关系会无声退化」这个问题。"
  "值得注意的是，这些工具并不是没意识到关系管理重要，"
  "而是都栽在同一个地方：录入数据的门槛太高。")

H("6.2 竞品分析", level=2)
TABLE(
    ["类别", "代表产品", "优势", "局限（也就是我们的机会）"],
    [
        ["系统通讯录", "Android / iOS 通讯录",
         "人人都有，零安装成本",
         "只有静态信息，从不提醒你去维护关系；也没有互动历史"],
        ["日历应用", "Google Calendar、系统日历",
         "时间管理成熟，生态完善",
         "只知道有哪些会，不知道和谁多久没联系；完全没有关系这一维度"],
        ["即时通讯", "微信、企业微信、Slack",
         "沟通确实发生在这里",
         "本质是沟通工具而非关系工具：不记录、不提醒、也没有关系状态统计"],
        ["CRM 系统", "Salesforce、HubSpot",
         "关系管理能力强，流程完善",
         "面向销售团队，重且贵；要求大量手工录入，结果销售普遍敷衍填写"],
        ["人脉管理 App", "各类名片 / 人脉管理工具",
         "概念与需求是契合的",
         "依赖手动记录，录入体验差；用户通常用三次就放弃了"],
    ],
    widths=[2.2, 3.4, 3.4, 6.5],
)

H("6.3 我们的差异点", level=2)
NUMBER("这是唯一真正的差异点，也正是其他工具没能解决的问题。"
       "竞品不是没想到要做关系管理，而是没法把「记录一次互动」的成本"
       "降到用户愿意长期承受的水平。语音把这个成本从约 30 秒压缩到约 3 秒。",
       "把录入门槛压到接近零。")
NUMBER("麦克风权限、后台通知、系统级提醒，这些恰恰是「主动提醒」这条原则的前提。"
       "只做网页，会直接丢掉产品一半的价值。", "原生移动优先，而不是网页。")
NUMBER("只做关怀，不做销售。这带来两个好处：面向个人而非团队，"
       "隐私压力小、决策链短；概念也简单，不需要培训就能明白这产品在干什么。",
       "聚焦职场关怀，而不是又一个 CRM。")
NUMBER("大多数工具停在「帮你记」；我们回答的是「今天该联系谁」，"
       "并且直接给出一份能照着做的清单和入口。", "从记录工具升级成行动建议。")

H("6.4 护城河其实不深——一个诚实的评估", level=2)
P("作为提案报告，有必要把话说清楚：这个产品的竞争壁垒是有限的。"
  "语音识别是公开的云服务能力，关系状态判定是可以被复制的规则，"
  "邮件草稿生成也已经高度同质化。真正有可能形成壁垒的只有两点：")
BULLET("语音在真实环境里的鲁棒性——嘈杂、方言口音、用户说错话。"
       "这直接决定用户信不信任这个产品。一次严重的误识别"
       "（比如把日程挂到了错误的人身上），对留存的伤害远大于十次成功。",
       "交互打磨的细致程度。")
BULLET("「117 天没联系就算需要关注」这类阈值，在不同关系类型下差别极大："
       "直属下属可能两周，跨部门同事可能半年。"
       "用一个统一阈值，既会漏报也会误报，而误报会很快把用户的耐心耗光。"
       "校准这件事需要真实的使用数据。", "关系判定模型的准确度。")

H("6.5 主要产品风险", level=2)
TABLE(
    ["风险", "说明", "应对方向"],
    [
        ["语音鲁棒性决定生死",
         "嘈杂环境或口音导致的识别错误，会让用户彻底失去信任",
         "重名时主动询问；失败时明确说明而非静默失败；支持取消与改期"],
        ["统一阈值可能站不住",
         "不同关系类型的合理联系频率差异很大，误报会消耗耐心",
         "按关系类型分别设阈值，并允许用户自行调整"],
        ["冷启动门槛偏高",
         "新用户面对空名册，很可能直接退出",
         "强化 CSV 导入引导；名册为空时提示先添加联系人"],
        ["隐私敏感",
         "「多久没联系」属于敏感的职场数据，用户会担心数据被怎么用",
         "数据严格按账号隔离；明确承诺不用于任何评估用途"],
        ["提醒容易变成打扰",
         "提醒太频繁会让用户关掉通知，产品的核心价值随之消失",
         "严格控制权限申请时机；提醒频率可配置"],
    ],
    widths=[2.8, 5.8, 7.0],
)

H("6.6 怎么验证这些判断", level=2)
TABLE(
    ["待验证的假设", "验证方式"],
    [
        ["语音确实比手动输入省事", "对比同一条日程用语音创建和手动创建各要多久"],
        ["「需要关注」清单真的有人用", "洞察页的查看率；从该页转化成已建日程的比例"],
        ["提醒会被行动，而不是被关掉", "通知的点击率；通知权限被收回的比例"],
        ["关系阈值定得是否合理", "用户对「高优先级」这一标记的接受度（是否经常被无视）"],
    ],
    widths=[6.0, 9.5],
)
P()
RICH([("其中最关键的指标，是从洞察页转化成关怀日程的比例。", True),
      ("如果用户看了「需要关注的人」却从来不动手，"
       "那这个产品就只是个有点意思的语音演示，而不是真的解决了什么问题。", False)])

# ================================================================== 7
P()
H("7. Conclusion", level=1)
P("职场关系的退化是无声的，而人们并非不在乎，只是记不住、也懒得记。"
  "TalentMate 伴贤用语音把记录的成本压到接近零，主动告诉你今天该关心谁，"
  "并在日程开始前把你叫醒——让「维护关系」这件事第一次变得能持续下去。")
RICH([("产品边界：", True), ("我们只帮你记住和安排，那句问候仍然要你自己说。", False)])

doc.save(OUT_DOCX)
print("DOCX:", OUT_DOCX)
print("大小: %.1f KB" % (os.path.getsize(OUT_DOCX) / 1024))
