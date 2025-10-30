/* ui.js - rendering and interactions */
(function(){
  window.App = window.App || {};

  // Internal state
  var state = {
    store: null,
    activeTab: 'import',
    currentPreviewRows: [],
    selectedQuizId: null,
    session: null // { quizId, order:[], index, answers:{}, startedAt, shuffleA, shuffleQ }
  };

  // Shortcuts
  var U = null;

  // DOM cache helpers
  function el(id){ return $('#' + id); }
  function toast(msg){
    var $t = $('#toast');
    $t.text(msg).removeClass('hidden').addClass('show');
    setTimeout(function(){ $t.addClass('hidden').removeClass('show'); }, 2200);
  }

  // Accessors
  function getQuizById(id){
    return (state.store.quizzes || []).find(function(q){ return q.id === id; }) || null;
  }

  function setActiveTab(tab){
    state.activeTab = tab;
    // tabs
    $('.tab-btn').removeClass('active');
    $('.tab-btn[data-tab="' + tab + '"]').addClass('active');
    // panels
    $('#panel-import').toggleClass('hidden', tab !== 'import');
    $('#panel-take').toggleClass('hidden', tab !== 'take');
    // player and results are controlled elsewhere
  }

  // Render quiz list sidebar
  function renderQuizList(){
    var $wrap = $('#quizzesList').empty();
    if (!state.store.quizzes.length) {
      $wrap.append($('<div class="text-sm text-slate-500">No quizzes yet. Import a CSV to get started.</div>'));
      return;
    }
    state.store.quizzes.forEach(function(q){
      var $item = $(`
        <div class="group border border-slate-200 rounded-xl p-3 hover:border-rose-300 transition">
          <div class="flex items-start justify-between">
            <div class="min-w-0">
              <div class="font-medium truncate">${U.htmlEscape(q.name)}</div>
              <div class="text-xs text-slate-500 mt-0.5">${q.questions.length} questions</div>
            </div>
            <div class="flex items-center gap-1 ml-3">
              <button class="menu-btn play">Play</button>
              <button class="menu-btn del" title="Delete">🗑</button>
            </div>
          </div>
        </div>
      `);
      $item.find('.play').on('click', function(){
        state.selectedQuizId = q.id;
        populateTakePanelSelection(q.id);
        setActiveTab('take');
        $('html,body').animate({ scrollTop: $('#panel-take').offset().top - 70 }, 200);
      });
      $item.find('.del').on('click', function(){
        if (!confirm('Delete quiz "' + q.name + '"? This cannot be undone.')) return;
        state.store.quizzes = state.store.quizzes.filter(function(qq){ return qq.id !== q.id; });
        window.App.saveStore(state.store);
        renderAll();
        toast('Quiz deleted');
      });
      $wrap.append($item);
    });
  }

  function renderHistory(quizId){
    var q = quizId ? getQuizById(quizId) : (state.selectedQuizId ? getQuizById(state.selectedQuizId) : null);
    var $chart = $('#historyChart').empty();
    var $meta = $('#historyMeta').empty();
    if (!q || !q.stats || !q.stats.attempts.length) {
      $meta.text('No attempts yet.');
      return;
    }
    var attempts = q.stats.attempts.slice(-24);
    var max = 100;
    attempts.forEach(function(a){
      var pct = Math.round((a.score / Math.max(1, a.total)) * 100);
      var h = Math.max(6, Math.round((pct / max) * 100));
      var $b = $('<div class="bar" title="' + pct + '%"></div>').css({ height: h + '%' }).addClass('bar').css('width','10px');
      $chart.append($b);
    });
    var last = attempts[attempts.length - 1];
    var best = attempts.reduce(function(m, a){ return Math.max(m, Math.round((a.score/Math.max(1,a.total))*100)); }, 0);
    $meta.text('Last: ' + Math.round((last.score/Math.max(1,last.total))*100) + '% • Best: ' + best + '% • ' + attempts.length + ' attempts');
  }

  // Preview table rendering
  function renderPreview(rows){
    var $wrap = $('#previewContainer').empty();
    if (!rows || !rows.length) {
      $wrap.append('<div class="p-4 text-sm text-slate-500">No CSV loaded yet.</div>');
      return;
    }
    var header = ['Question', 'Answer', 'Option 1', 'Option 2', 'Option 3+'];
    var $table = $('<div class="table-scroll"><table></table></div>');
    var $t = $table.find('table');
    var $thead = $('<thead><tr></tr></thead>');
    header.forEach(function(h){ $thead.find('tr').append('<th scope="col">' + U.htmlEscape(h) + '</th>'); });
    $t.append($thead);
    var $tb = $('<tbody></tbody>');
    rows.slice(0, 30).forEach(function(r){
      var cols = [r[0]||'', r[1]||'', r[2]||'', r[3]||'', r.slice(4).join(' | ')];
      var $tr = $('<tr></tr>');
      cols.forEach(function(c){ $tr.append('<td>' + U.htmlEscape(c) + '</td>'); });
      $tb.append($tr);
    });
    $t.append($tb);
    $wrap.append($table);
  }

  function populateTakePanelSelection(preselectId){
    var $sel = $('#quizSelect').empty();
    state.store.quizzes.forEach(function(q){
      var $opt = $('<option></option>').attr('value', q.id).text(q.name);
      if (preselectId && q.id === preselectId) $opt.attr('selected', 'selected');
      $sel.append($opt);
    });
    if (!preselectId && state.store.quizzes.length) {
      $sel.val(state.store.quizzes[0].id);
    }
  }

  // Quiz Player
  function startSession(options){
    var quizId = options.quizId;
    var shuffleQ = !!options.shuffleQ;
    var shuffleA = !!options.shuffleA;
    var limit = options.limit;
    var quiz = getQuizById(quizId);
    if (!quiz) return;

    var order = quiz.questions.map(function(q, idx){ return idx; });
    if (shuffleQ) order = U.shuffle(order);
    if (limit && limit > 0) order = order.slice(0, Math.min(limit, order.length));

    state.session = {
      quizId: quizId,
      order: order,
      index: 0,
      answers: {},
      startedAt: Date.now(),
      shuffleQ: shuffleQ,
      shuffleA: shuffleA
    };
    persistSession();
    showPanel('player');
    renderPlayer();
    toast('Quiz started');
  }

  function persistSession(){ window.AppStorage.setJSON('session', state.session); }
  function clearSession(){ state.session = null; window.AppStorage.remove('session'); }

  function resumeIfAvailable(){
    var sess = window.AppStorage.getJSON('session');
    if (sess && getQuizById(sess.quizId)) { state.session = sess; $('#resumeBtn').removeClass('hidden'); }
  }

  function showPanel(name){
    $('#panel-import').toggleClass('hidden', name !== 'import');
    $('#panel-take').toggleClass('hidden', name !== 'take');
    $('#panel-player').toggleClass('hidden', name !== 'player');
    $('#panel-results').toggleClass('hidden', name !== 'results');
  }

  function renderPlayer(){
    var sess = state.session; if (!sess) return;
    var quiz = getQuizById(sess.quizId); if (!quiz) return;
    var qIndex = sess.order[sess.index];
    var q = quiz.questions[qIndex];
    // header
    $('#qIndex').text(sess.index + 1);
    $('#qTotal').text(sess.order.length);
    var pct = Math.round(((sess.index) / Math.max(1, sess.order.length)) * 100);
    $('#progressBar').css('width', pct + '%');

    // render question
    var $wrap = $('#questionContainer').empty();
    var $title = $('<h3 class="text-xl font-bold"></h3>').text(q.text);
    $wrap.append($title);

    if (q.type === 'mcq') {
      // prepare choices, shuffle per session if needed
      var choices = q.choices.slice();
      var mapping = choices.map(function(_, i){ return i; });
      if (state.session.shuffleA) {
        // shuffle mapping
        mapping = U.shuffle(mapping);
      }
      var selected = (sess.answers[qIndex] != null) ? sess.answers[qIndex] : null;
      var $list = $('<div class="mt-4 space-y-2"></div>');
      mapping.forEach(function(i){
        var text = choices[i];
        var isSel = selected === i;
        var $btn = $('<button type="button" class="answer-btn"></button>').text(text);
        if (isSel) $btn.addClass('answer-selected');
        $btn.on('click', function(){
          sess.answers[qIndex] = i;
          persistSession();
          // highlight selection
          $list.find('button').removeClass('answer-selected');
          $btn.addClass('answer-selected');
        });
        $list.append($btn);
      });
      $wrap.append($list);
    } else {
      var prev = sess.answers[qIndex] || '';
      var $input = $('<input type="text" class="input mt-4" placeholder="Type your answer">').val(prev);
      $wrap.append($input);
      var $save = $('<div class="mt-3 text-right"><button class="btn-secondary">Save answer</button></div>');
      $save.find('button').on('click', function(){
        sess.answers[qIndex] = $input.val();
        persistSession();
        toast('Answer saved');
      });
      $wrap.append($save);
    }

    // nav buttons state
    $('#prevBtn').prop('disabled', sess.index === 0);
    $('#nextBtn').text(sess.index === sess.order.length - 1 ? 'Review' : 'Next');
  }

  function scoreSession(){
    var sess = state.session; var quiz = getQuizById(sess.quizId);
    var correct = 0; var total = sess.order.length; var details = [];
    sess.order.forEach(function(qPos){
      var q = quiz.questions[qPos];
      var user = sess.answers[qPos];
      var isCorrect = false;
      if (q.type === 'mcq') {
        // correct is index 0 in original choices
        isCorrect = (user === 0);
      } else {
        if (typeof user === 'string') {
          var norm = user.trim().toLowerCase();
          var syns = q.answerSynonyms.length ? q.answerSynonyms : [q.answer];
          isCorrect = syns.some(function(s){ return norm === s.trim().toLowerCase(); });
        }
      }
      if (isCorrect) correct += 1;
      details.push({ q: q, user: user, correct: isCorrect });
    });
    return { correct: correct, total: total, details: details, durationMs: Date.now() - (sess.startedAt || Date.now()) };
  }

  function renderResults(){
    var sess = state.session; if (!sess) return;
    var quiz = getQuizById(sess.quizId); if (!quiz) return;
    var res = scoreSession();
    // save attempt
    quiz.stats = quiz.stats || { attempts: [], best: null };
    quiz.stats.attempts.push({ score: res.correct, total: res.total, on: Date.now(), durationMs: res.durationMs });
    var pct = Math.round((res.correct/Math.max(1,res.total))*100);
    quiz.stats.best = Math.max(quiz.stats.best || 0, pct);
    window.App.saveStore(state.store);

    $('#resultPill').text(pct + '% correct');

    var $sum = $('#resultsSummary').empty();
    res.details.forEach(function(d, i){
      var $row = $('<div class="mt-3 p-3 rounded-xl border border-slate-200"></div>');
      var icon = d.correct ? '✔' : '✖';
      var color = d.correct ? 'text-emerald-600' : 'text-rose-600';
      $row.append('<div class="flex items-start justify-between"><div class="font-medium">Q' + (i+1) + '. ' + U.htmlEscape(d.q.text) + '</div><div class="'+color+'">' + icon + '</div></div>');
      if (d.q.type === 'mcq') {
        var userLabel = (typeof d.user === 'number') ? d.q.choices[d.user] : '(no answer)';
        $row.append('<div class="text-sm text-slate-600 mt-1">Your answer: ' + U.htmlEscape(userLabel || '') + '</div>');
        $row.append('<div class="text-sm text-slate-600">Correct: ' + U.htmlEscape(d.q.choices[0]) + '</div>');
      } else {
        $row.append('<div class="text-sm text-slate-600 mt-1">Your answer: ' + U.htmlEscape(d.user || '(no answer)') + '</div>');
        $row.append('<div class="text-sm text-slate-600">Accepted: ' + U.htmlEscape(d.q.answer) + '</div>');
      }
      $sum.append($row);
    });

    renderHistory(quiz.id);
  }

  function endSession(){
    showPanel('results');
    renderResults();
    clearSession();
  }

  function wireEvents(){
    // Tabs
    $('.tab-btn').on('click', function(){ setActiveTab($(this).data('tab')); });

    // New quiz clears importer
    $('#newQuizBtn').on('click', function(){
      setActiveTab('import');
      $('#quizNameInput').val('');
      state.currentPreviewRows = [];
      renderPreview([]);
      $('html,body').animate({ scrollTop: 0 }, 150);
    });

    // CSV dropzone
    var $dz = $('#csvDropZone');
    function prevent(e){ e.preventDefault(); e.stopPropagation(); }
    $dz.on('drag dragstart dragend dragover dragenter dragleave drop', prevent)
       .on('dragover dragenter', function(){ $dz.addClass('dragover'); })
       .on('dragleave dragend drop', function(){ $dz.removeClass('dragover'); })
       .on('drop', function(e){
          var f = e.originalEvent.dataTransfer.files[0];
          if (f) readFile(f);
       });

    $('#browseBtn').on('click', function(){ $('#fileInput').click(); });
    $('#fileInput').on('change', function(e){ var f = e.target.files[0]; if (f) readFile(f); });

    // Paste modal
    $('#pasteBtn').on('click', function(){ $('#pasteModal').removeClass('hidden').addClass('flex'); $('#pasteArea').focus(); });
    $('#closePasteBtn').on('click', function(){ $('#pasteModal').addClass('hidden').removeClass('flex'); });
    $('#clearPasteBtn').on('click', function(){ $('#pasteArea').val(''); $('#pasteArea').focus(); });
    $('#importPasteBtn').on('click', function(){
      var text = $('#pasteArea').val();
      if (!text.trim()) { toast('Nothing to import'); return; }
      handleCSVText(text);
      $('#pasteModal').addClass('hidden').removeClass('flex');
    });

    // Save quiz
    $('#saveQuizBtn').on('click', function(){
      var name = ($('#quizNameInput').val() || '').trim();
      if (!name) { toast('Name your quiz first'); return; }
      if (!state.currentPreviewRows.length) { toast('Import some questions first'); return; }
      var mapped = U.toQuestions(state.currentPreviewRows);
      if (mapped.errors.length) { toast('Some rows were invalid: ' + mapped.errors[0]); }
      var quiz = { id: U.uid('quiz'), name: name, createdAt: Date.now(), questions: mapped.questions, stats: { attempts: [], best: null } };
      state.store.quizzes.push(quiz);
      window.App.saveStore(state.store);
      renderAll();
      toast('Quiz saved');
      // switch to Take tab with this quiz selected
      populateTakePanelSelection(quiz.id);
      setActiveTab('take');
    });

    // Take panel actions
    $('#startQuizBtn').on('click', function(){
      var qid = $('#quizSelect').val();
      if (!qid) { toast('Select a quiz'); return; }
      startSession({ quizId: qid, shuffleQ: $('#optShuffleQ').is(':checked'), shuffleA: $('#optShuffleA').is(':checked'), limit: parseInt($('#limitCount').val(), 10) || null });
    });

    $('#resumeBtn').on('click', function(){ if (state.session) { showPanel('player'); renderPlayer(); } });

    // Player nav
    $('#prevBtn').on('click', function(){ if (!state.session) return; state.session.index = Math.max(0, state.session.index - 1); persistSession(); renderPlayer(); });
    $('#nextBtn').on('click', function(){ if (!state.session) return; if (state.session.index >= state.session.order.length - 1) { showPanel('results'); renderResults(); clearSession(); } else { state.session.index += 1; persistSession(); renderPlayer(); } });
    $('#finishBtn').on('click', function(){ if (state.session) { endSession(); } });

    // Results actions
    $('#retryBtn').on('click', function(){
      var qid = $('#quizSelect').val();
      startSession({ quizId: qid, shuffleQ: $('#optShuffleQ').is(':checked'), shuffleA: $('#optShuffleA').is(':checked'), limit: parseInt($('#limitCount').val(), 10) || null });
    });
    $('#backToTakeBtn').on('click', function(){ showPanel('take'); renderHistory($('#quizSelect').val()); });

    // Refresh and selection
    $('#refreshBtn').on('click', function(){ renderAll(); toast('Refreshed'); });
  }

  function readFile(file){
    var reader = new FileReader();
    reader.onload = function(e){ handleCSVText(e.target.result || ''); };
    reader.onerror = function(){ toast('Failed to read file'); };
    reader.readAsText(file);
  }

  function handleCSVText(text){
    try {
      var rows = U.parseCSV(text);
      if (!rows.length) { toast('No rows detected'); return; }
      state.currentPreviewRows = rows;
      renderPreview(rows);
      toast('CSV loaded: ' + rows.length + ' rows');
    } catch (err) {
      console.error('CSV parse error', err);
      toast('Could not parse CSV');
    }
  }

  function renderTakePanel(){
    populateTakePanelSelection(state.selectedQuizId);
    resumeIfAvailable();
    renderHistory($('#quizSelect').val());
  }

  function renderAll(){
    renderQuizList();
    renderPreview(state.currentPreviewRows);
    renderTakePanel();
  }

  // Public API per contract
  window.App.init = function(){
    U = window.App.util;
    state.store = window.App.loadStore();
    wireEvents();
    setActiveTab('import');
  };

  window.App.render = function(){
    renderAll();
  };

})();
