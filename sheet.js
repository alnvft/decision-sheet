// 判断事項の回答シート（Claude の show_widget 用）
// 使い方: <div id="ds"></div> と
//   <script type="application/json" id="ds-data">{"P":"Q","D":[["見出し","空白の理由",["選択肢1","選択肢2"]]]}</script>
//   を置いてからこのファイルを読み込む（sheet(P, D, el, S) で直接描くこともできる）
// "S" は開始番号（省略時は1）。設問の4番目の要素に番号を書くと、その設問はその番号で表示する
// コピーを押すと「Q1：2」形式の行と備考をクリップボードに入れる（貼り付けと送信はユーザーが行う）
(() => {
  const CSS = `
.ds-root{font-family:"Anthropic Sans","Yu Gothic UI","Meiryo UI",system-ui,sans-serif}
.ds-q{margin:0 0 10px}
.ds-q:first-child{padding-right:48px}
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
#ds-go{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;height:26px!important;min-height:0!important;margin:0!important;padding:0 14px!important;line-height:1!important;font-family:inherit!important;font-size:13px!important;border:0.5px solid var(--border-strong)!important;border-radius:var(--radius)!important;background:var(--surface-2)!important;color:var(--text-primary)!important;cursor:pointer}
#ds-go:disabled{opacity:.5;cursor:default}
.ds-err{font-size:13px;color:var(--text-danger)}
.ds-err.ds-ok{color:var(--text-muted)}
.ds-man{display:block;width:100%;box-sizing:border-box;margin-top:4px;font-family:inherit;font-size:13px;line-height:1.5;padding:4px 8px;border:0.5px solid var(--border-strong);border-radius:4px;background:var(--surface-2);color:var(--text-primary);resize:none}`;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const render = (el, P, D, S = 1) => {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    const root = document.createElement('div');
    root.className = 'ds-root';
    root.innerHTML =
      '<h2 class="sr-only">判断事項の回答シート。各設問で一つ選ぶか却下し、備考は最下部の欄にまとめて書いて送信する。</h2>' +
      '<div class="ds-s"></div>' +
      '<div class="ds-f"><textarea id="ds-all" placeholder="全体の備考（Enterで改行。＋備考で設問番号が入る）"></textarea>' +
      '<span class="ds-c"></span><button type="button" id="ds-go">コピー</button></div>' +
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

    // 番号を指定した設問はその番号、指定のない設問は S から順に振る
    let n = S;
    D.forEach(([t, w, o, num]) => {
      const k = P + (num ?? n++), q = document.createElement('div');
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
    const go = root.querySelector('#ds-go');
    go.onclick = () => {
      // 「Qn：〜」の備考は該当設問の行に半角スペースで続け、番号のない行だけ末尾の備考に残す
      const keys = [...s.children].map(q => q.dataset.k), kr = new RegExp('^(' + P + '\\d+)：(.*)$'), N = {}, rest = [];
      A.value.split('\n').forEach(l => {
        const m = l.match(kr);
        if (m && keys.includes(m[1])) { const t = m[2].trim(); if (t) N[m[1]] = N[m[1]] ? N[m[1]] + ' / ' + t : t; }
        else if (l.trim()) rest.push(l);
      });
      const a = rest.join('\n').trim();
      if (!Object.keys(v).length && !a && !Object.keys(N).length) { E.classList.remove('ds-ok'); E.textContent = '一つ以上回答してください'; return; }
      const L = keys.map(k => k + '：' + [v[k], N[k]].filter(Boolean).join(' '));
      const text = L.join('\n') + (a ? '\n備考：\n' + a : '');
      go.disabled = true;
      copy(text).then(ok => {
        go.disabled = false;
        root.querySelector('.ds-man')?.remove();
        E.classList.add('ds-ok');
        if (ok) { E.textContent = 'コピーしました。入力欄に貼り付けて送信してください'; return; }
        // 自動でコピーできないときは、選択済みの欄に出して手でコピーしてもらう
        E.textContent = '自動でコピーできませんでした。下の欄が選択された状態なので、Ctrl+C でコピーしてください';
        const m = document.createElement('textarea');
        m.className = 'ds-man'; m.readOnly = true; m.rows = text.split('\n').length; m.value = text;
        root.appendChild(m); m.focus(); m.select();
      });
    };

    // クリップボードAPIが使えなければ execCommand で試す
    const copy = async t => {
      try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* 次の方法へ */ }
      const ta = document.createElement('textarea');
      ta.value = t; ta.readOnly = true;
      ta.style.cssText = 'position:absolute;left:-9999px;top:0';
      root.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    };
  };

  window.sheet = (P, D, el, S) => render(el || document.getElementById('ds') || document.body, P, D, S);

  // #ds と #ds-data があれば、読み込み順に関係なく描画する
  const run = () => {
    const el = document.getElementById('ds'), dt = document.getElementById('ds-data');
    if (!el || !dt || el.dataset.done) return;
    try {
      const { P, D, S } = JSON.parse(dt.textContent);
      render(el, P, D, S);
    } catch (e) {
      el.textContent = '設問データを読めませんでした：' + e.message;
    }
  };
  run();
  document.addEventListener('DOMContentLoaded', run);
})();
