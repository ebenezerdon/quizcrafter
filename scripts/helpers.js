/* helpers.js - utilities, storage, and CSV parsing */
(function(){
  // Namespace setup
  window.App = window.App || {};

  // Local storage manager with namespacing and safety
  window.AppStorage = {
    prefix: 'quizcrafter:',
    get: function(key){
      try { return localStorage.getItem(this.prefix + key); } catch (e) { console.warn('Storage get failed', e); return null; }
    },
    set: function(key, value){
      try { localStorage.setItem(this.prefix + key, value); } catch (e) { console.warn('Storage set failed', e); }
    },
    getJSON: function(key, fallback){
      try {
        var raw = localStorage.getItem(this.prefix + key);
        if (!raw) return (typeof fallback === 'undefined' ? null : fallback);
        return JSON.parse(raw);
      } catch (e) {
        console.warn('Storage parse failed', e);
        return (typeof fallback === 'undefined' ? null : fallback);
      }
    },
    setJSON: function(key, obj){
      try { localStorage.setItem(this.prefix + key, JSON.stringify(obj)); } catch (e) { console.warn('Storage setJSON failed', e); }
    },
    remove: function(key){ try { localStorage.removeItem(this.prefix + key); } catch (e) {} }
  };

  // Utility functions
  window.App.util = {
    uid: function(prefix){
      var p = prefix || 'id';
      return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    },
    clamp: function(n, min, max){ return Math.max(min, Math.min(max, n)); },
    shuffle: function(arr){
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    htmlEscape: function(str){
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    detectDelimiter: function(text){
      var sample = (text || '').split(/\r?\n/).slice(0, 10).join('\n');
      var counts = { ',': 0, ';': 0, '\t': 0 };
      sample.split(/\r?\n/).forEach(function(line){
        counts[','] += (line.match(/,/g) || []).length;
        counts[';'] += (line.match(/;/g) || []).length;
        counts['\t'] += (line.match(/\t/g) || []).length;
      });
      var best = ','; var max = -1;
      Object.keys(counts).forEach(function(k){ if (counts[k] > max) { max = counts[k]; best = k; } });
      return best === '\t' ? '\t' : best;
    },
    parseCSV: function(text){
      if (!text || !text.trim()) return [];
      var delim = window.App.util.detectDelimiter(text);
      var rows = [];
      var i = 0, field = '', inQuotes = false, row = [];
      function pushField(){ row.push(field); field = ''; }
      function pushRow(){ rows.push(row); row = []; }
      while (i < text.length) {
        var char = text[i];
        if (inQuotes) {
          if (char === '"') {
            if (text[i+1] === '"') { field += '"'; i++; }
            else { inQuotes = false; }
          } else { field += char; }
        } else {
          if (char === '"') { inQuotes = true; }
          else if (char === delim) { pushField(); }
          else if (char === '\n') { pushField(); pushRow(); }
          else if (char === '\r') { /* ignore */ }
          else { field += char; }
        }
        i++;
      }
      // flush last
      if (field.length || row.length) { pushField(); pushRow(); }
      // trim trailing empty row
      if (rows.length && rows[rows.length - 1].every(function(c){ return c.trim() === ''; })) rows.pop();
      return rows.map(function(cols){ return cols.map(function(c){ return c.trim(); }); });
    },
    toQuestions: function(rows){
      // Map CSV rows to question objects: supports MCQ and short-answer (2 columns)
      var questions = []; var errors = [];
      rows.forEach(function(cols, idx){
        if (!cols || cols.length < 2 || !cols[0] || !cols[1]) {
          errors.push('Row ' + (idx+1) + ' is missing question or answer.');
          return;
        }
        var q = cols[0];
        var answer = cols[1];
        var opts = cols.slice(2).filter(function(x){ return x && x.length; });
        var type = opts.length ? 'mcq' : 'short';
        var choiceList = [];
        var correctIndex = -1;
        if (type === 'mcq') {
          choiceList = [answer].concat(opts);
          // shuffle choices but record correct index later during run (we can reshuffle per session)
          correctIndex = 0; // marker that first is correct pre-shuffle
        }
        // Allow synonyms separated by | or /
        var synonyms = answer.split(/\s*[\|\/]\s*/).filter(function(s){ return s; });
        questions.push({
          id: window.App.util.uid('q'),
          type: type,
          text: q,
          answer: answer,
          answerSynonyms: synonyms,
          choices: choiceList,
          correctIndex: correctIndex
        });
      });
      return { questions: questions, errors: errors };
    },
    formatDate: function(ts){
      try { var d = new Date(ts); return d.toLocaleString(); } catch (e) { return '' + ts; }
    },
    percent: function(num, den){ if (!den) return '0%'; var p = Math.round((num/den)*100); return p + '%'; }
  };

  // Store bootstrap with sample quiz if empty
  function defaultStore(){
    return {
      quizzes: [],
      createdAt: Date.now(),
      lastSession: null
    };
  }

  window.App.loadStore = function(){
    var store = window.AppStorage.getJSON('store');
    if (!store) {
      store = defaultStore();
      // Seed with small sample
      var sampleRows = [
        ['Capital of France', 'Paris', 'Lyon', 'Marseille', 'Nice'],
        ['H2O is known as', 'Water', 'Oxygen', 'Hydrogen'],
        ['2 + 2', '4', '3', '5'],
        ['Author of 1984', 'George Orwell|Orwell', 'Aldous Huxley', 'Ray Bradbury'],
        ['Largest planet', 'Jupiter', 'Mars', 'Earth', 'Venus']
      ];
      var mapped = window.App.util.toQuestions(sampleRows);
      store.quizzes.push({
        id: window.App.util.uid('quiz'),
        name: 'Sample: General Knowledge',
        createdAt: Date.now(),
        questions: mapped.questions,
        stats: { attempts: [], best: null }
      });
      window.AppStorage.setJSON('store', store);
    }
    return store;
  };

  window.App.saveStore = function(store){ window.AppStorage.setJSON('store', store); };

})();
