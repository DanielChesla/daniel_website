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

  // ---------------------------------------------------------------------------
  // Current conditions (weather bar)
  //   Wind / air temp / water temp: NOAA CO-OPS met sensors at the nearest
  //     gauge with instruments — station 8723970 "Vaca Key, Florida Bay"
  //     (~2 mi from the bridge; Pigeon Key has no met/water-temp sensor).
  //   Precipitation + sky condition: Open-Meteo current (keyless, CORS-enabled).
  // ---------------------------------------------------------------------------

  var MET_STATION_ID = "8723970";
  var BRIDGE_LAT = 24.7033;
  var BRIDGE_LON = -81.155;
  var COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  // Condensed WMO weather-code map (Open-Meteo).
  var WMO = {
    0: "☀️ Clear", 1: "🌤️ Mainly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
    45: "🌫️ Fog", 48: "🌫️ Rime fog",
    51: "🌦️ Light drizzle", 53: "🌦️ Drizzle", 55: "🌦️ Heavy drizzle",
    61: "🌧️ Light rain", 63: "🌧️ Rain", 65: "🌧️ Heavy rain",
    66: "🌧️ Freezing rain", 67: "🌧️ Freezing rain",
    71: "🌨️ Light snow", 73: "🌨️ Snow", 75: "🌨️ Heavy snow",
    80: "🌦️ Light showers", 81: "🌧️ Showers", 82: "⛈️ Violent showers",
    95: "⛈️ Thunderstorm", 96: "⛈️ Thunderstorm w/ hail", 99: "⛈️ Severe thunderstorm"
  };

  function knotsToMph(kt) { return kt * 1.15078; }

  function degToCompass(deg) {
    return COMPASS[Math.round(deg / 22.5) % 16];
  }

  function fetchNoaaLatest(product) {
    var url = API + "?" + [
      "date=latest",
      "station=" + MET_STATION_ID,
      "product=" + product,
      "units=english",
      "time_zone=lst_ldt",
      "format=json",
      "application=daniel_website_tides"
    ].join("&");
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (j.error || !j.data || !j.data.length) throw new Error(product + " unavailable");
        return j.data[0];
      });
  }

  function fetchOpenMeteo() {
    var url = "https://api.open-meteo.com/v1/forecast?" + [
      "latitude=" + BRIDGE_LAT,
      "longitude=" + BRIDGE_LON,
      "current=temperature_2m,precipitation,weather_code",
      "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant",
      "temperature_unit=fahrenheit",
      "wind_speed_unit=mph",
      "precipitation_unit=inch",
      "timezone=America%2FNew_York",
      "forecast_days=2"
    ].join("&");
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { if (!j.current) throw new Error("weather unavailable"); return j; });
  }

  function fetchMarine() {
    var url = "https://marine-api.open-meteo.com/v1/marine?" + [
      "latitude=" + BRIDGE_LAT,
      "longitude=" + BRIDGE_LON,
      "current=wave_height,wave_direction,wave_period",
      "length_unit=imperial",
      "timezone=America%2FNew_York"
    ].join("&");
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j.current || j.current.wave_height == null) throw new Error("wave data unavailable");
        return j.current;
      });
  }

  function val(settled) { return settled.status === "fulfilled" ? settled.value : null; }

  function tile(icon, label, value, sub, testid) {
    return "<div class=\"col\" data-testid=\"" + testid + "\">" +
      "<div class=\"card border-0 shadow-sm h-100 cond-tile\">" +
      "<div class=\"card-body text-center\">" +
      "<div class=\"cond-icon\">" + icon + "</div>" +
      "<div class=\"cond-value\">" + value + "</div>" +
      "<div class=\"cond-label\">" + label + "</div>" +
      (sub ? "<div class=\"cond-sub text-secondary\">" + sub + "</div>" : "") +
      "</div></div></div>";
  }

  function renderConditions(results) {
    var wind   = val(results[0]);
    var air    = val(results[1]);
    var water  = val(results[2]);
    var wx     = val(results[3]);
    var marine = val(results[4]);

    // Wind
    var windVal = "—", windSub = "";
    if (wind) {
      var mph = knotsToMph(parseFloat(wind.s));
      var dir = wind.dr || (isNaN(parseFloat(wind.d)) ? "" : degToCompass(parseFloat(wind.d)));
      windVal = mph.toFixed(1) + " mph";
      windSub = dir + (isNaN(parseFloat(wind.d)) ? "" : " (" + Math.round(wind.d) + "°)");
      if (!isNaN(parseFloat(wind.g))) windSub += " · gusts " + knotsToMph(parseFloat(wind.g)).toFixed(0) + " mph";
    }

    // Precip + sky condition (Open-Meteo current)
    var precipVal = "—", precipSub = "";
    if (wx && wx.current) {
      precipVal = parseFloat(wx.current.precipitation).toFixed(2) + " in";
      precipSub = WMO[wx.current.weather_code] || "";
    }

    // Wave height (Open-Meteo marine)
    var waveVal = "—", waveSub = "";
    if (marine) {
      waveVal = parseFloat(marine.wave_height).toFixed(1) + " ft";
      var wparts = [];
      if (marine.wave_direction != null) wparts.push(degToCompass(marine.wave_direction) + " (" + Math.round(marine.wave_direction) + "°)");
      if (marine.wave_period != null) wparts.push(Math.round(marine.wave_period) + "s period");
      waveSub = wparts.join(" · ");
    }

    var html =
      tile("🌬️", "Wind", windVal, windSub, "cond-tile-wind") +
      tile("🌡️", "Air Temp", air ? Math.round(air.v) + "°F" : "—", "", "cond-tile-air") +
      tile("🌊", "Water Temp", water ? Math.round(water.v) + "°F" : "—", "", "cond-tile-water") +
      tile("🌊", "Wave Height", waveVal, waveSub, "cond-tile-wave") +
      tile("🌧️", "Precipitation", precipVal, precipSub, "cond-tile-precip");

    setHTML("conditions", html);

    // Meta line: observation time + sources
    var obs = (wind && wind.t) || (air && air.t) || (water && water.t);
    var when = "";
    if (obs) {
      var s = parseStamp(obs);
      when = "Observed " + fmtTime(s.hh, s.mm) + " · ";
    }
    setHTML("conditions-meta",
      when + "Wind/air/water: NOAA Vaca Key (8723970). Precipitation & waves: Open-Meteo.");
  }

  function renderForecast(settled) {
    var wx = val(settled);
    if (!wx || !wx.daily || !wx.daily.time || wx.daily.time.length < 2) {
      setHTML("forecast", "<div class=\"alert alert-warning mb-0\" role=\"alert\">Forecast is currently unavailable.</div>");
      return;
    }
    var d = wx.daily;
    var i = 1; // index 1 = tomorrow (index 0 = today)

    var dObj = (function () {
      var p = d.time[i].split("-");
      return new Date(+p[0], +p[1] - 1, +p[2]);
    })();
    var heading = dObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    var cond = WMO[d.weather_code[i]] || "—";
    var hi = Math.round(d.temperature_2m_max[i]);
    var lo = Math.round(d.temperature_2m_min[i]);
    var pop = d.precipitation_probability_max[i];
    var psum = parseFloat(d.precipitation_sum[i]).toFixed(2);
    var wspd = Math.round(d.wind_speed_10m_max[i]);
    var wdir = degToCompass(d.wind_direction_10m_dominant[i]);

    var html =
      "<div class=\"card border-0 shadow-sm\" data-testid=\"forecast-card-1\">" +
      "<div class=\"card-body\">" +
      "<div class=\"row g-3 align-items-center\">" +
        "<div class=\"col-lg-4\">" +
          "<div class=\"text-secondary small\">Tomorrow &middot; " + heading + "</div>" +
          "<div class=\"fc-cond mt-1\">" + cond + "</div>" +
        "</div>" +
        "<div class=\"col-6 col-lg-2 fc-metric\">🌡️ High / Low<br><span class=\"fc-num\">" + hi + "° / " + lo + "°F</span></div>" +
        "<div class=\"col-6 col-lg-2 fc-metric\">🌧️ Precip<br><span class=\"fc-num\">" + pop + "%</span> <span class=\"text-secondary\">(" + psum + " in)</span></div>" +
        "<div class=\"col-6 col-lg-2 fc-metric\">🌬️ Wind<br><span class=\"fc-num\">" + wspd + " mph</span> " + wdir + "</div>" +
        "<div class=\"col-6 col-lg-2 fc-metric text-lg-end\"><a class=\"small\" href=\"https://open-meteo.com/\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a></div>" +
      "</div>" +
      "</div></div>";

    setHTML("forecast", html);
  }

  function loadConditions() {
    setHTML("conditions", "<div class=\"col-12\"><p class=\"text-secondary mb-0\" data-testid=\"conditions-loading-1\">Loading current conditions…</p></div>");
    setHTML("conditions-meta", "");
    setHTML("forecast", "<p class=\"text-secondary mb-0\" data-testid=\"forecast-loading-1\">Loading forecast…</p>");
    Promise.allSettled([
      fetchNoaaLatest("wind"),
      fetchNoaaLatest("air_temperature"),
      fetchNoaaLatest("water_temperature"),
      fetchOpenMeteo(),
      fetchMarine()
    ]).then(function (results) {
      renderConditions(results);
      renderForecast(results[3]);
    });
  }

  // expose + auto-run
  window.loadTides = loadTides;
  window.loadConditions = loadConditions;
  document.addEventListener("DOMContentLoaded", function () {
    loadConditions();
    loadTides();
  });
})();
