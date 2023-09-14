// JavaScript code
document.addEventListener("DOMContentLoaded", function () {
    let whiteBtn = document.getElementById("white-btn");
    whiteBtn.addEventListener("click", function () {
        changeBackgroundColor("white");
    });

    let greenBtn = document.getElementById("green-btn");
    greenBtn.addEventListener("click", function () {
        changeBackgroundColor("rgb(220, 255, 220)");
    });

    let ltblueBtn = document.getElementById("ltblue-btn");
    ltblueBtn.addEventListener("click", function () {
        changeBackgroundColor("rgb(220, 255, 255)");
    });

    function changeBackgroundColor(newColor) {
        document.body.style.backgroundColor = newColor;
    }

    let blackBtn = document.getElementById("black-btn");
    blackBtn.addEventListener("click", function () {
        changeTextColor("rgb(0, 0, 0)");
    });

    let darkBlueBtn = document.getElementById("darkBlue-btn");
    darkBlueBtn.addEventListener("click", function () {
        changeTextColor("rgb(0, 0, 210)");
    });

    let purpleBtn = document.getElementById("purple-btn");
    purpleBtn.addEventListener("click", function () {
        changeTextColor("rgb(165, 0, 225)");
    });

    function changeTextColor(newColor) {
        document.body.style.color = newColor;
    }

    let lizardBtn = document.getElementById("lizard-btn");
    lizardBtn.addEventListener("click", function () {
        changeImage("lizard.jpg");
    });

    let birdBtn = document.getElementById("bird-btn");
    birdBtn.addEventListener("click", function () {
        changeImage("bird.jpg");
    });

    let dogBtn = document.getElementById("dog-btn");
    dogBtn.addEventListener("click", function () {
        changeImage("dog.jpg");
    });

        let suzukiBtn = document.getElementById("suzuki-btn");
    suzukiBtn.addEventListener("click", function () {
        changeImage("suzuki.jpg");
    });

        let frogBtn = document.getElementById("frog-btn");
    frogBtn.addEventListener("click", function () {
        changeImage("frog.jpg");
    });

    function changeImage(newImage) {
        document.getElementById("image").src = newImage;
    }
});
