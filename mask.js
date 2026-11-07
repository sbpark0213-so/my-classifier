/* 이름 · 전화번호 · 사번을 가린다. 브라우저 안에서만 돈다. */
(function (root) {
  var NOT_NAME = ['신입', '신규', '경력', '담당', '담당자', '직원', '관리자', '고객', '임원', '팀원', '동료', '퇴사한'];
  var TITLE = '사원|대리|과장|차장|부장|팀장|주임|대표|이사|님|씨|연구간호사|간호사|교수|코디네이터';

  function mask(text) {
    var found = [];
    var s = String(text);

    // 전화번호
    s = s.replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, function () {
      found.push('전화번호');
      return '[전화번호]';
    });

    // 사번: «사번 12345», «사번은 12345»
    s = s.replace(/사번\s*[은는이가:]?\s*\d{3,}/g, function () {
      found.push('사번');
      return '[사번]';
    });

    // 환자 등록번호: «환자 등록번호 P-00000»
    s = s.replace(/환자\s*등록\s*번호\s*[은는이가:]?\s*[A-Za-z]*-?\d{3,}/g, function () {
      found.push('환자등록번호');
      return '[환자등록번호]';
    });

    // 이름: «홍길동 사원», «김아무개님»
    s = s.replace(new RegExp('(?<![가-힣])([가-힣]{2,4})(\\s*)(' + TITLE + ')', 'g'), function (all, name, sp, title) {
      if (NOT_NAME.indexOf(name) >= 0) return all;
      found.push('이름');
      return '[이름]' + sp + title;
    });

    // 이름: 자기소개 «성춘향입니다» (글머리나 쉼표 뒤의 세 글자)
    s = s.replace(/(^|[,.!?]\s*)([가-힣]{3})(?=입니다|이에요|예요)/g, function (all, pre) {
      found.push('이름');
      return pre + '[이름]';
    });

    return { text: s, found: found };
  }

  root.Mask = { mask: mask };
  if (typeof module !== 'undefined') module.exports = root.Mask;
})(typeof window !== 'undefined' ? window : globalThis);
