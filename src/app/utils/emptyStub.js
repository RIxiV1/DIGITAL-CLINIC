// Empty stub used to short-circuit jsPDF's optional html2canvas /
// dompurify dependencies. We never call jsPDF's .html() method, so
// those packages are pure dead weight — but Rollup still ships them as
// lazy chunks (~230KB combined) because they're reachable via dynamic
// imports inside jsPDF. Aliased here at build time so the chunks
// resolve to nothing. If we ever start using jsPDF.html(), remove the
// alias entries in vite.config.ts.

export default {};
