// tides.js
// Fetches high/low tide predictions for the Seven Mile Bridge (Marathon, FL)
// from NOAA CO-OPS and renders the next 3 days.
//
// Data source: NOAA Tides & Currents CO-OPS API (official U.S. government data).
//   Station 8724032 — "PIGEON KEY ATLANTIC SIDE" — sits directly on the
//   Seven Mile Bridge, so it is the closest official tide-prediction station.
//   Docs: https://api.tidesandcurrents.noaa.gov/api/prod/

(function () {
  "use strict";

  var STATION_ID = "8724032";
  var STATION_NAME = "Pigeon Key (Seven Mile Bridge), Marathon FL";
  var API = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

  function $(id) { return document.getElementById(id); }
  function setHTML(id, html) { var el = $(id); if (el) el.innerHTML = html; }

  // Format a Date as NOAA's yyyyMMdd.
  function ymd(d) {
    return d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
  }

  // NOAA timestamps look like "2026-07-10 05:14" (local station time already,
  // because we request time_zone=lst_ldt). Split without relying on TZ parsing.
  function parseStamp(t) {
    var parts = t.split(" ");                 // ["2026-07-10", "05:14"]
    var d = parts[0].split("-");              // ["2026","07","10"]
    var hm = parts[1].split(":");             // ["05","14"]
    return {
      dayKey: parts[0],
      dateObj: new Date(+d[0], +d[1] - 1, +d[2]),
      hh: +hm[0],
      mm: +hm[1]
    };
  }

  function fmtTime(hh, mm) {
    var ampm = hh >= 12 ? "PM" : "AM";
    var h12 = hh % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + String(mm).padStart(2, "0") + " " + ampm;
  }

  function fmtDayHeading(dateObj, isToday) {
    var opts = { weekday: "long", month: "long", day: "numeric" };
    var label = dateObj.toLocaleDateString("en-US", opts);
    return isToday ? label + " &middot; <span class=\"tide-today\">Today</span>" : label;
  }

  function buildUrl(begin, end) {
    var q = [
      "station=" + STATION_ID,
      "product=predictions",
      "datum=MLLW",
      "time_zone=lst_ldt",
      "interval=hilo",
      "units=english",
      "format=json",
      "application=daniel_website_tides",
      "begin_date=" + ymd(begin),
      "end_date=" + ymd(end)
    ];
    return API + "?" + q.join("&");
  }

  function render(predictions) {
    if (!predictions || !predictions.length) {
      setHTML("tides", "<p class=\"text-secondary mb-0\">No tide predictions were returned for this period.</p>");
      return;
    }

    var todayKey = ymd(new Date());
    // formatted as yyyy-MM-dd to match dayKey
    var t = new Date();
    todayKey = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");

    // Group predictions by day, preserving order.
    var days = [];
    var index = {};
    predictions.forEach(function (p) {
      var s = parseStamp(p.t);
      if (!index.hasOwnProperty(s.dayKey)) {
        index[s.dayKey] = days.length;
        days.push({ key: s.dayKey, dateObj: s.dateObj, events: [] });
      }
      days[index[s.dayKey]].events.push({
        isHigh: p.type === "H",
        time: fmtTime(s.hh, s.mm),
        height: parseFloat(p.v).toFixed(1)
      });
    });

    var html = "";
    days.forEach(function (day) {
      var isToday = day.key === todayKey;
      html += "<div class=\"tide-day card border-0 shadow-sm mb-3\" data-testid=\"tide-day-card-" + day.key + "\">";
      html += "<div class=\"card-body\">";
      html += "<h3 class=\"h5 mb-3 tide-day-heading\">" + fmtDayHeading(day.dateObj, isToday) + "</h3>";
      html += "<div class=\"table-responsive\"><table class=\"table table-sm align-middle mb-0 tide-table\">";
      html += "<thead><tr><th scope=\"col\">Tide</th><th scope=\"col\">Time</th><th scope=\"col\" class=\"text-end\">Height</th></tr></thead><tbody>";
      day.events.forEach(function (ev) {
        var badge = ev.isHigh
          ? "<span class=\"badge tide-badge-high\">&#9650; High</span>"
          : "<span class=\"badge tide-badge-low\">&#9660; Low</span>";
        html += "<tr>";
        html += "<td>" + badge + "</td>";
        html += "<td>" + ev.time + "</td>";
        html += "<td class=\"text-end fw-semibold\">" + ev.height + " ft</td>";
        html += "</tr>";
      });
      html += "</tbody></table></div>";
      html += "</div></div>";
    });

    setHTML("tides", html);
  }

  function error(msg) {
    setHTML("tides",
      "<div class=\"alert alert-warning mb-0\" role=\"alert\" data-testid=\"tide-error-alert-1\">" +
      (msg || "Tide data is currently unavailable. Please try again shortly.") +
      "</div>");
  }

  function loadTides() {
    setHTML("tides", "<p class=\"text-secondary mb-0\" data-testid=\"tide-loading-1\">Loading tide predictions&hellip;</p>");

    var begin = new Date();
    var end = new Date();
    end.setDate(end.getDate() + 2); // today + next 2 = 3 calendar days

    fetch(buildUrl(begin, end), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.error && data.error.message) {
          throw new Error(data.error.message);
        }
        render(data && data.predictions);
      })
      .catch(function (e) {
        error("Tide data unavailable (" + e.message + ").");
      });
  }

  // expose + auto-run
  window.loadTides = loadTides;
  document.addEventListener("DOMContentLoaded", loadTides);
})();
