// 判断事項の回答シート（Claude の show_widget 用）
// 使い方: <div id="ds"></div> と
//   <script type="application/json" id="ds-data">{"P":"Q","D":[["見出し","空白の理由",["選択肢1","選択肢2"]]]}</script>
//   を置いてからこのファイルを読み込む（sheet(P, D, el) で直接描くこともできる）
// 送信すると「Q1：2」形式の行と備考を sendPrompt でチャット入力欄へ渡す
(() => {
  const CSS = `
.ds-q{margin:0 0 10px}
.ds-h{font-size:14px;font-weight:500;line-height:1.6;color:var(--text-primary)}
.ds-h small{font-weight:400;font-size:13px;color:var(--text-secondary)}
.ds-o{display:flex;align-items:baseline;gap:6px;padding:0 0 0 2px;font-size:14px;line-height:1.55;color:var(--text-primary);cursor:pointer}
.ds-o input{margin:0;flex:none;cursor:pointer}
.ds-o:has(input:checked){color:var(--text-accent);font-weight:500}
.ds-rej .ds-o{color:var(--text-muted);text-decoration:line-through}
.ds-b{font-size:14px;font-weight:400;color:var(--text-muted);cursor:pointer;margin-left:8px;user-select:none}
.ds-b:hover{color:var(--text-secondary)}
.ds-x.ds-on{color:var(--text-danger);font-weight:500}
.ds-f{display:flex;gap:8px;align-items:flex-end;border-top:0.5px solid var(--border);padding-top:8px}
#ds-all{flex:1!important;box-sizing:border-box!important;min-height:63px!important;height:63px;margin:0!important;padding:4px 8px!important;font-family:inherit!important;font-size:14px!important;line-height:1.5!important;border:0.5px solid var(--border)!important;border-radius:4px!important;background:var(--surface-2)!important;color:var(--text-primary)!important;resize:none!important;outline:none!important;overflow:hidden!important}
#ds-all:focus{border-color:var(--border-strong)!important}
.ds-c{font-size:12px;color:var(--text-muted);white-space:nowrap}
#ds-go{height:26px;padding:0 14px;border:0.5px solid var(--border-strong);border-radius:var(--radius);background:var(--surface-2);color:var(--text-primary);font-size:13px;cursor:pointer}
.ds-err{font-size:13px;color:var(--text-danger)}`;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const render = (el, P, D) => {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    const root = document.createElement('div');
    root.innerHTML =
      '<h2 class="sr-only">判断事項の回答シート。各設問で一つ選ぶか却下し、備考は最下部の欄にまとめて書いて送信する。</h2>' +
      '<div class="ds-s"></div>' +
      '<div class="ds-f"><textarea id="ds-all" placeholder="全体の備考（Enterで改行。＋備考で設問番号が入る）"></textarea>' +
      '<span class="ds-c"></span><button type="button" id="ds-go">送信</button></div>' +
      '<div class="ds-err"></div>';
    el.textContent = '';
    el.dataset.done = '1';
    el.appendChild(root);

    const s = root.querySelector('.ds-s'), A = root.querySelector('#ds-all'),
      C = root.querySelector('.ds-c'), E = root.querySelector('.ds-err'), v = {};
    const re = (k, x) => new RegExp('^' + k + '：' + x + '$', 'm');
    const cnt = () => { C.textContent = Object.keys(v).length + '/' + D.length; E.textContent = ''; };
    const grow = () => {
      A.style.setProperty('height', 'auto', 'important');
      A.style.setProperty('height', A.scrollHeight + 2 + 'px', 'important');
    };
    // 備考欄に「Qn：〜」の行があれば印を＊に変える
    const mark = () => s.querySelectorAll('.ds-q').forEach(q => {
      const m = A.value.match(re(q.dataset.k, '(.*)'));
      q.querySelector('.ds-n').textContent = m && m[1].trim() ? '＊備考' : '＋備考';
    });
    // ＋備考：その設問の行が既にあれば行末へ、なければ「Qn：」を足してカーソルを置く
    const add = k => {
      let t = A.value, p;
      const m = t.match(re(k, '.*'));
      if (m) p = m.index + m[0].length;
      else {
        t += (t && !t.endsWith('\n') ? '\n' : '') + k + '：';
        A.value = t; p = t.length; grow();
      }
      A.focus(); A.setSelectionRange(p, p);
    };

    D.forEach(([t, w, o], i) => {
      const k = P + (i + 1), q = document.createElement('div');
      q.className = 'ds-q'; q.dataset.k = k;
      q.innerHTML =
        '<div class="ds-h">' + k + '：' + esc(t) + (w ? ' <small>（' + esc(w) + '）</small>' : '') +
        '<span class="ds-b ds-x" role="button">×却下</span><span class="ds-b ds-n" role="button">＋備考</span></div>' +
        o.map((x, j) => '<label class="ds-o"><input type="checkbox" value="' + (j + 1) + '">' + (j + 1) + '. ' + esc(x) + '</label>').join('');
      const x = q.querySelector('.ds-x');
      x.onclick = () => {
        const on = !q.classList.contains('ds-rej');
        q.classList.toggle('ds-rej', on); x.classList.toggle('ds-on', on);
        q.querySelectorAll('.ds-o input').forEach(c => c.checked = false);
        if (on) v[k] = '却下'; else delete v[k];
        cnt();
      };
      q.querySelector('.ds-n').onclick = () => add(k);
      // チェックボックスは設問ごとに一つだけ。選ぶと却下は解除される
      q.onchange = e => {
        const c = e.target;
        if (c.type !== 'checkbox') return;
        q.classList.remove('ds-rej'); x.classList.remove('ds-on');
        q.querySelectorAll('.ds-o input').forEach(y => { if (y !== c) y.checked = false; });
        if (c.checked) v[k] = c.value; else delete v[k];
        cnt();
      };
      s.appendChild(q);
    });
    cnt();

    A.oninput = () => { grow(); mark(); E.textContent = ''; };
    root.querySelector('#ds-go').onclick = () => {
      const L = [...s.children].map(q => q.dataset.k + '：' + (v[q.dataset.k] || ''));
      const empty = new RegExp('^' + P + '\\d+：\\s*$');
      const a = A.value.split('\n').filter(l => l.trim() && !empty.test(l)).join('\n').trim();
      if (!Object.keys(v).length && !a) { E.textContent = '一つ以上回答してください'; return; }
      sendPrompt(L.join('\n') + (a ? '\n備考：\n' + a : ''));
    };
  };

  window.sheet = (P, D, el) => render(el || document.getElementById('ds') || document.body, P, D);

  // #ds と #ds-data があれば、読み込み順に関係なく描画する
  const run = () => {
    const el = document.getElementById('ds'), dt = document.getElementById('ds-data');
    if (!el || !dt || el.dataset.done) return;
    try {
      const { P, D } = JSON.parse(dt.textContent);
      render(el, P, D);
    } catch (e) {
      el.textContent = '設問データを読めませんでした：' + e.message;
    }
  };
  run();
  document.addEventListener('DOMContentLoaded', run);
})();
