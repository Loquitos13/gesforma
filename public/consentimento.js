/*
 * Google Tag Manager (GTM-P9FGVZ7) com o Consent Mode v2 (modo avançado), só no site público. Os 4 sinais começam
 * recusados; se a pessoa já escolheu no banner de cookies (src/site/BannerCookies.tsx), a escolha vale logo aqui.
 * Fica de fora o backoffice, a área do formando e as ligações pessoais (com códigos no endereço).
 */
(function () {
  if (/^\/(gesforma|entrar|area-formando|documentos|documentos-formando|assinar|verificar|faturacao|inquerito|cronograma)(\/|$)/.test(location.pathname)) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    functionality_storage: "granted", security_storage: "granted", wait_for_update: 500,
  });
  try {
    var c = JSON.parse(localStorage.getItem("ena_consentimento") || "null");
    if (c && c.validade > Date.now()) {
      var a = c.analise ? "granted" : "denied", m = c.marketing ? "granted" : "denied";
      gtag("consent", "update", { analytics_storage: a, ad_storage: m, ad_user_data: m, ad_personalization: m });
    }
  } catch (e) { /* sem armazenamento: fica tudo recusado */ }
  window.__enaGtm = true;
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtm.js?id=GTM-P9FGVZ7";
  document.head.appendChild(s);
})();
