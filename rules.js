/* 낱말 규칙으로 가른다. 낱말과 순서는 keywords.json · criteria.json 에서 읽는다. */
(function (root) {
  function squash(s) { return String(s).replace(/\s+/g, ''); }

  function firstHit(text, names, table) {
    var t = squash(text);
    for (var i = 0; i < names.length; i++) {
      var words = (table[names[i]] && table[names[i]].낱말) || [];
      for (var j = 0; j < words.length; j++) {
        if (t.indexOf(squash(words[j])) >= 0) return { name: names[i], word: words[j] };
      }
    }
    return null;
  }

  function classify(text, criteria, keywords) {
    var catNames = criteria.category_order;
    var urgNames = criteria.urgency.map(function (u) { return u.name; });
    var c = firstHit(text, catNames, keywords.칸);
    var u = firstHit(text, urgNames, keywords.긴급도);
    var none = keywords.없을때;
    var cat = c ? c.name : none.칸;
    var urg = u ? u.name : none.긴급도;
    var reason = (c ? '‘' + c.word + '’ 낱말이 있어 ' + cat : '맞는 낱말이 없어 ' + cat) +
      ' · ' + (u ? '‘' + u.word + '’ 낱말이 있어 ' + urg : '맞는 낱말이 없어 ' + urg);
    return { category: cat, urgency: urg, reason: reason };
  }

  root.Rules = { classify: classify };
  if (typeof module !== 'undefined') module.exports = root.Rules;
})(typeof window !== 'undefined' ? window : globalThis);
