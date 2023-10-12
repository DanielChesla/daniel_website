function responseReceivedHandler() {
    let weatherInfo = document.getElementById("weather");
    if (this.status === 200) {
        const response = this.response;

        if (response.hasOwnProperty("sys") && response.sys.hasOwnProperty("sunrise") && response.sys.hasOwnProperty("sunset")) {
            const sunriseTimestamp = response.sys.sunrise;
            const sunsetTimestamp = response.sys.sunset;
            const cityLoc = response.name;
            

            const sunriseTime = new Date(sunriseTimestamp * 1000).toLocaleTimeString();
            const sunsetTime = new Date(sunsetTimestamp * 1000).toLocaleTimeString();

            weatherInfo.innerHTML =
            "<p>Current weather in " + cityLoc + "</p>" +    
            "<p>Current temp: " + response.main.temp + " &deg;F</p>" +
                "<p>Desc: " + response.weather[0].description + "</p>" +
                "<p>Humidity: " + response.main.humidity + "%</p>" +
                "<p>Wind: " + response.main.wind + " mph</p>" +
                "<p>Sunrise: " + sunriseTime + "</p>" +
                "<p>Sunset: " + sunsetTime + "</p>";
        } else {
            weatherInfo.innerHTML = "Sunrise and sunset data unavailable.";
        }
    } else {
        weatherInfo.innerHTML = "Weather data unavailable.";
    }
}

function getWeather(zip) {
    let endpoint = "https://api.openweathermap.org/data/2.5/weather";
    let apiKey = "f172ef4f73d598f9e70a6145241ee2df";
    let queryString = "zip=" + zip + "&units=imperial&appid=" + apiKey;
    let url = endpoint + "?" + queryString;
 
    let xhr = new XMLHttpRequest();
    xhr.addEventListener("load", responseReceivedHandler);
    xhr.responseType = "json";
    xhr.open("GET", url);
    xhr.send();
 }



