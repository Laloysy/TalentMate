/**
 * 邮件 HTML 净化。
 *
 * 邮件正文由后端模板渲染后，前端用 dangerouslySetInnerHTML 展示预览。
 * 正文里可能包含不可信内容（例如用户自己填写的备注、联系人信息），
 * 因此渲染前必须净化，禁止脚本、事件属性、javascript: 协议与不受控 iframe。
 *
 * 说明：方案把「邮件 HTML 净化」列为服务端整改项（阶段 5），
 * 这里先在前端做一层防御，避免预览即执行；服务端仍需补上同样的一层
 * （邮件真正发出的那一步，收件人客户端不一定会拦）。
 */
import DOMPurify from 'dompurify';

/** 邮件预览允许的标签（表格布局是邮件 HTML 的常见写法，需保留） */
const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];

/** 允许的属性：样式与表格布局所需，其余一律剥离 */
const ALLOWED_ATTR = [
  'align', 'alt', 'border', 'cellpadding', 'cellspacing', 'class', 'colspan', 'height',
  'href', 'rowspan', 'src', 'style', 'target', 'title', 'valign', 'width',
];

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  // 所有链接强制新窗口打开并加上 noopener，避免被 opener 反控
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    // 图片同样加 referrerpolicy，减少隐私泄漏
    if (node.tagName === 'IMG') {
      node.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
}

/**
 * 净化邮件 HTML。
 * @param {string} html 原始 HTML
 * @returns {string} 可安全用于 dangerouslySetInnerHTML 的 HTML
 */
export function sanitizeEmailHtml(html) {
  if (!html || typeof html !== 'string') return '';
  installHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 禁止 data: 与 javascript: 协议（DOMPurify 默认会拦 javascript:，
    // 这里显式收窄，只允许 http/https/mailto/tel 与相对路径）
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // 不允许 <template>、<style> 等可被滥用的结构
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'template', 'base', 'meta', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onbegin', 'onanimationstart', 'formaction', 'xlink:href', 'srcdoc'],
    // 保留 data-* 无必要，直接禁止
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

export default sanitizeEmailHtml;
