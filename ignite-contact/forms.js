/* IgniteGTM contact forms — progressive enhancement over a plain <form> POST.
   JS path: fetch JSON → inline success panel. JS-off: normal form POST,
   the endpoint 303-redirects back with ?sent=1 and we show success. */

(function () {
  var form = document.getElementById("intakeForm");
  var success = document.getElementById("successPanel");
  var err = document.getElementById("errNote");
  if (!form || !success) return;

  // record where the visitor came from
  var src = document.getElementById("srcField");
  if (src) src.value = document.referrer || "";

  // returning from a no-JS submit
  if (new URLSearchParams(location.search).get("sent") === "1") {
    form.hidden = true;
    success.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    err.hidden = true;

    var data = new FormData(form);
    var payload = {
      form: data.get("form"),
      first_name: data.get("first_name"),
      last_name: data.get("last_name"),
      email: data.get("email"),
      company: data.get("company"),
      interests: data.getAll("interests"),
      source: data.get("source"),
      website: data.get("website"), // honeypot travels too
    };

    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function () {
        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function () {
        btn.disabled = false;
        err.hidden = false;
      });
  });
})();
