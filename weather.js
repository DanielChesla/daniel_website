// weather_patched.js
// Backwards compatible with your existing getWeather(zip) and #weather element.
// Improvements: accepts city names too, defaults country to US for 5-digit zips, null-safe DOM updates, clearer errors.

(function(){
  function $(id){ return document.getElementById(id); }
  function setHTML(id, html){ const el=$(id); if(el) el.innerHTML = html; }
  function fmtTime(ts){ return new Date(ts*1000).toLocaleTimeString(); }
  function isZip(s){ return /^[0-9]{5}$/.test(s.trim()); }

  function render(data){
    const cityLoc = data.name;
    const cityWind = data.wind?.speed ?? '—';
    const sunriseTime = data.sys?.sunrise ? fmtTime(data.sys.sunrise) : '—';
    const sunsetTime = data.sys?.sunset ? fmtTime(data.sys.sunset) : '—';
    const temp = data.main?.temp ?? '—';
    const desc = data.weather?.[0]?.description ?? '—';
    const humidity = data.main?.humidity ?? '—';
    setHTML("weather",
      "<p style='font-size: 22px; text-decoration: underline;'>Current weather in " + cityLoc + "</p>" +
      "<p>Current temp: " + temp + " &deg;F</p>" +
      "<p>Desc: " + desc + "</p>" +
      "<p>Humidity: " + humidity + "%</p>" +
      "<p>Wind: " + cityWind + " mph</p>" +
      "<p>Sunrise: " + sunriseTime + "</p>" +
      "<p>Sunset: " + sunsetTime + "</p>"
    );
  }

  function error(msg){
    setHTML("weather", msg || "Weather data unavailable.");
  }

  function getWeather(input){
    const endpoint = "https://api.openweathermap.org/data/2.5/weather";
    const apiKey = "f172ef4f73d598f9e70a6145241ee2df"; // your key
    const q = isZip(input) ? ("zip=" + encodeURIComponent(input + ",us")) : ("q=" + encodeURIComponent(input));
    const url = endpoint + "?" + q + "&units=imperial&appid=" + apiKey;

    const xhr = new XMLHttpRequest();
    xhr.responseType = "json";
    xhr.addEventListener("load", function(){
      if(this.status === 200 && this.response){
        render(this.response);
      }else{
        const detail = (this.response && (this.response.message || this.response.cod)) ? (" (" + this.response.cod + ": " + this.response.message + ")") : "";
        error("Weather data unavailable" + detail + ".");
      }
    });
    xhr.addEventListener("error", function(){ error("Network error fetching weather."); });
    xhr.open("GET", url);
    xhr.send();
  }

  // expose
  window.getWeather = getWeather;
})();