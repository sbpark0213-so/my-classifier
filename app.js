(function () {
  var criteria, keywords, answers = null, practice = [], lastSample = -1;
  var lastAi = null;      // 마지막 AI 채점 결과 (내려받기용)
  var busy = false;
  var classifyToken = 0;
  var BATCH = 10;
  var $ = function (id) { return document.getElementById(id); };

  function load(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function loadAnswers() {
    if (answers) return Promise.resolve(answers);
    return load('data/answer.json').then(function (v) { answers = v; return v; });
  }

  function pct(n, d) { return d ? Math.round(n / d * 1000) / 10 + '%' : '-'; }

  // 규칙 판정 (가린 문장으로)
  function run(text) {
    var m = Mask.mask(text);
    var r = Rules.classify(m.text, criteria, keywords);
    r.masked = m.text;
    return r;
  }

  // 서버 함수(Gemini)에 가린 문장 여러 개를 보낸다. 문장마다 {ok, category, urgency, reason} 또는 {ok:false, error}
  function askAi(texts) {
    return fetch('api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: texts })
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { /* 아래에서 처리 */ }
        if (!r.ok || !j || !j.ok) {
          throw new Error((j && j.error) || ('서버가 ' + r.status + ' 로 답했습니다.'));
        }
        return j;
      });
    });
  }

  function showTab(name) {
    ['classify', 'grade'].forEach(function (n) {
      var on = n === name;
      $('pane-' + n).hidden = !on;
      $('tab-' + n).classList.toggle('on', on);
      $('tab-' + n).setAttribute('aria-selected', on);
    });
  }

  // ---------- 분류 탭 ----------
  function showResult(masked, cat, urg, reason, source) {
    $('r-masked').textContent = masked;
    $('r-cat').textContent = cat;
    $('r-urg').textContent = urg;
    $('r-reason').textContent = reason;
    $('r-source').textContent = source;
    $('result').hidden = false;
  }

  function doClassify() {
    var text = $('input').value.trim();
    if (!text || busy) return;
    var token = ++classifyToken;
    var rule = run(text);
    showResult(rule.masked, '…', '…', '…', 'AI 판단 중…');
    $('go').disabled = true;
    askAi([rule.masked]).then(function (j) {
      if (token !== classifyToken) return;
      var a = j.results[0];
      if (!a || !a.ok) throw new Error((a && a.error) || 'AI 가 이 문장의 답을 주지 않았습니다.');
      showResult(rule.masked, a.category, a.urgency, a.reason, 'AI(' + j.model + ')가 갈랐습니다');
    }).catch(function (e) {
      if (token !== classifyToken) return;
      showResult(rule.masked, rule.category, rule.urgency, rule.reason,
        'AI 없이 규칙으로 갈랐습니다 (' + e.message + ')');
    }).then(function () {
      if (token === classifyToken) $('go').disabled = false;
    });
  }

  function putSample() {
    if (!practice.length) return;
    var i;
    do { i = Math.floor(Math.random() * practice.length); } while (practice.length > 1 && i === lastSample);
    lastSample = i;
    var p = practice[i];
    $('input').value = p.text;
    $('result').hidden = true;
    var n = $('sample-note');
    n.textContent = '연습용 ' + p.id + ' · 이 문장에 붙은 답(' + p.label_by + '): ' + p.category + ' / ' + p.urgency;
    n.hidden = false;
  }

  // ---------- 채점 탭 ----------
  function setBusy(on) {
    busy = on;
    $('grade').disabled = on;
    $('grade-ai').disabled = on;
    $('go').disabled = on;
  }

  // 규칙으로 채점한 결과 (문장마다)
  function gradeRules(list) {
    return list.map(function (a) {
      var r = run(a.text);
      return { a: a, masked: r.masked, c: r.category, u: r.urgency };
    });
  }

  function countRules(rows) {
    var k = { cat: 0, urg: 0, both: 0, n: rows.length, miss: 0 };
    rows.forEach(function (x) {
      var c = x.c === x.a.category, u = x.u === x.a.urgency;
      if (c) k.cat++;
      if (u) k.urg++;
      if (c && u) k.both++;
    });
    return k;
  }

  function countAi(rows) {
    var k = { cat: 0, urg: 0, both: 0, n: rows.length, miss: 0 };
    rows.forEach(function (x) {
      if (!x.ai || !x.ai.ok) { k.miss++; return; }   // 답을 못 받은 문장은 오답
      var c = x.ai.category === x.a.category, u = x.ai.urgency === x.a.urgency;
      if (c) k.cat++;
      if (u) k.urg++;
      if (c && u) k.both++;
    });
    return k;
  }

  function renderRuleScore(rows) {
    var k = countRules(rows), wrong = $('wrong');
    wrong.textContent = '';
    rows.forEach(function (x) {
      var c = x.c === x.a.category, u = x.u === x.a.urgency;
      if (c && u) return;
      var li = document.createElement('li');
      var id = document.createElement('div'); id.className = 'id'; id.textContent = x.a.id;
      var tx = document.createElement('div'); tx.textContent = x.masked;
      var df = document.createElement('div'); df.className = 'diff';
      var parts = [];
      if (!c) parts.push('칸 ' + x.a.category + ' → ' + x.c);
      if (!u) parts.push('긴급도 ' + x.a.urgency + ' → ' + x.u);
      df.textContent = parts.join(' · ');
      li.appendChild(id); li.appendChild(tx); li.appendChild(df);
      wrong.appendChild(li);
    });
    $('s-cat').textContent = pct(k.cat, k.n) + ' (' + k.cat + '/' + k.n + ')';
    $('s-urg').textContent = pct(k.urg, k.n) + ' (' + k.urg + '/' + k.n + ')';
    $('s-both').textContent = k.both + '/' + k.n;
    $('score').hidden = false;
  }

  function doGrade() {
    if (busy) return;
    $('grade-msg').textContent = '';
    loadAnswers().then(function (list) {
      renderRuleScore(gradeRules(list));
    }).catch(function () {
      $('grade-msg').textContent = '정답 파일(data/answer.json)을 읽지 못했습니다.';
    });
  }

  function cell(tr, text, tag) {
    var td = document.createElement(tag || 'td');
    td.textContent = text;
    tr.appendChild(td);
  }

  function renderCompare(rk, ak) {
    var tb = $('compare-body');
    tb.textContent = '';
    [
      ['칸 정확도', pct(rk.cat, rk.n) + ' (' + rk.cat + '/' + rk.n + ')', pct(ak.cat, ak.n) + ' (' + ak.cat + '/' + ak.n + ')'],
      ['긴급도 정확도', pct(rk.urg, rk.n) + ' (' + rk.urg + '/' + rk.n + ')', pct(ak.urg, ak.n) + ' (' + ak.urg + '/' + ak.n + ')'],
      ['둘 다 맞은 수', rk.both + '/' + rk.n, ak.both + '/' + ak.n],
      ['답을 못 받은 문장 (오답으로 셈)', rk.miss + '건', ak.miss + '건']
    ].forEach(function (r) {
      var tr = document.createElement('tr');
      cell(tr, r[0], 'th'); cell(tr, r[1]); cell(tr, r[2]);
      tb.appendChild(tr);
    });
    $('compare').hidden = false;
  }

  function doGradeAi() {
    if (busy) return;
    $('grade-msg').textContent = '';
    $('compare').hidden = true;
    $('download').hidden = true;
    setBusy(true);
    loadAnswers().then(function (list) {
      var ruleRows = gradeRules(list);
      var aiRows = ruleRows.map(function (x) { return { a: x.a, masked: x.masked, ai: null, error: '' }; });
      var model = '';
      var done = 0;
      $('grade-msg').textContent = 'AI 채점 중… 0/' + aiRows.length;

      function step(start) {
        if (start >= aiRows.length) return Promise.resolve();
        var slice = aiRows.slice(start, start + BATCH);
        return askAi(slice.map(function (x) { return x.masked; })).then(function (j) {
          if (j.model) model = j.model;
          slice.forEach(function (x, i) {
            var r = j.results[i];
            x.ai = r || null;
            if (!r || !r.ok) x.error = (r && r.error) || '답이 오지 않았습니다.';
          });
        }).catch(function (e) {
          slice.forEach(function (x) { x.ai = null; x.error = e.message; });
        }).then(function () {
          done += slice.length;
          $('grade-msg').textContent = 'AI 채점 중… ' + done + '/' + aiRows.length;
          return step(start + BATCH);
        });
      }

      return step(0).then(function () {
        var rk = countRules(ruleRows), ak = countAi(aiRows);
        renderRuleScore(ruleRows);
        renderCompare(rk, ak);
        var firstError = '';
        aiRows.some(function (x) { if (x.error) { firstError = x.error; return true; } return false; });
        $('grade-msg').textContent = 'AI 채점이 끝났습니다.' +
          (ak.miss ? ' 답을 못 받은 문장 ' + ak.miss + '건 (' + firstError + ')' : '');
        lastAi = {
          측정시각: new Date().toISOString(),
          모델: model,
          기준: { owner: criteria.owner, version: criteria.version },
          규칙: { 칸맞음: rk.cat, 긴급도맞음: rk.urg, 둘다맞음: rk.both, 전체: rk.n },
          AI: { 칸맞음: ak.cat, 긴급도맞음: ak.urg, 둘다맞음: ak.both, 전체: ak.n, 답못받음: ak.miss },
          문장: aiRows.map(function (x, i) {
            return {
              id: x.a.id,
              가린문장: x.masked,
              정답: { 칸: x.a.category, 긴급도: x.a.urgency },
              규칙: { 칸: ruleRows[i].c, 긴급도: ruleRows[i].u },
              AI: x.ai && x.ai.ok ? { 칸: x.ai.category, 긴급도: x.ai.urgency, 이유: x.ai.reason } : null,
              AI오류: x.error || ''
            };
          })
        };
        $('download').hidden = false;
      });
    }).catch(function () {
      $('grade-msg').textContent = 'AI 채점을 끝내지 못했습니다. 정답 파일을 읽지 못했을 수 있습니다.';
    }).then(function () { setBusy(false); });
  }

  function download() {
    if (!lastAi) return;
    var blob = new Blob([JSON.stringify(lastAi, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ai_채점결과.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- 연결 ----------
  $('tab-classify').onclick = function () { showTab('classify'); };
  $('tab-grade').onclick = function () { showTab('grade'); };
  $('go').onclick = doClassify;
  $('sample').onclick = putSample;
  $('sample').disabled = true;
  $('input').addEventListener('input', function () { $('sample-note').hidden = true; });
  $('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') doClassify(); });
  $('grade').onclick = doGrade;
  $('grade-ai').onclick = doGradeAi;
  $('download').onclick = download;
  $('go').disabled = $('grade').disabled = $('grade-ai').disabled = true;
  load('data/practice.json').then(function (v) { practice = v; $('sample').disabled = false; }).catch(function () {});

  Promise.all([load('criteria.json'), load('keywords.json')])
    .then(function (v) {
      criteria = v[0]; keywords = v[1];
      $('status').textContent = '기준 v' + criteria.version + ' · ' + criteria.owner;
      $('go').disabled = $('grade').disabled = $('grade-ai').disabled = false;
    })
    .catch(function () {
      var s = $('status');
      s.className = 'status err';
      s.textContent = '기준 · 낱말 파일을 읽지 못했습니다. 파일을 그냥 열지 말고 폴더를 웹 주소(예: 로컬 서버)로 열어 주세요.';
    });
})();
