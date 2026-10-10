' 用后期绑定（late binding）调用 Word 把 docx 导出为 PDF。
'
' 为什么需要它：本机 Word 的 PIA/类型库加载失败
'   QueryInterface ... _Application  failed
'   HRESULT: 0x80029C4A (TYPE_E_CANTLOADLIBRARY)
' 这是 Office 类型库注册损坏，与文档本身无关。
' PowerShell 的 New-Object -ComObject 会走类型库，因此失败；
' VBScript 的 CreateObject 是纯 IDispatch 后期绑定，不需要类型库，可以绕开。
'
' 用法: cscript //nologo export_pdf.vbs <输入docx> <输出pdf>

Option Explicit

If WScript.Arguments.Count < 2 Then
    WScript.Echo "usage: cscript export_pdf.vbs <in.docx> <out.pdf>"
    WScript.Quit 2
End If

Dim inPath, outPath
inPath = WScript.Arguments(0)
outPath = WScript.Arguments(1)

Dim word, doc
On Error Resume Next
Set word = CreateObject("Word.Application")
If Err.Number <> 0 Then
    WScript.Echo "CreateObject failed: " & Err.Description
    WScript.Quit 1
End If
On Error GoTo 0

word.Visible = False
word.DisplayAlerts = 0

On Error Resume Next
Set doc = word.Documents.Open(inPath, False, True)
If Err.Number <> 0 Then
    WScript.Echo "Open failed: " & Err.Description
    word.Quit
    WScript.Quit 1
End If
On Error GoTo 0

' wdExportFormatPDF = 17
On Error Resume Next
doc.ExportAsFixedFormat outPath, 17
If Err.Number <> 0 Then
    WScript.Echo "Export failed: " & Err.Description
    doc.Close False
    word.Quit
    WScript.Quit 1
End If
On Error GoTo 0

doc.Close False
word.Quit
WScript.Echo "OK"
WScript.Quit 0
