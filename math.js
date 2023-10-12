function max(arr) {
    let max = arr[0];

    for (let i = 0; i < arr.length; i++) {
        if (arr[i] >= max) {
            max = arr[i];
        }
    }
    return max;
}

function min(arr) {
    let min = arr[0];

    for (let i = 0; i < arr.length; i++) {
        if (arr[i] < min) {
            min = arr[i];
        }
    }
    return min;
}

function mean(arr) {
    let sum = 0;

    for (let num of arr) {
        sum += num;
    }

    return Math.floor(sum / arr.length);
}

function median(arr) {
    arr = arr.sort ((a,b) => a - b);

    if (arr.length %2 !== 0 ) {
    return arr[Math.floor(arr.length / 2)];
    }   
    else {
        let mid1 = arr[arr.length / 2];
        let mid2 = arr[arr.length / 2 - 1];
        return (mid1 + mid2) / 2;
    }
}

function range(arr) {

}

function calculate() {

    let val1 = parseInt(document.getElementById("firstnumber").value);
    let val2 = parseInt(document.getElementById("secondnumber").value);
    let val3 = parseInt(document.getElementById("thirdnumber").value);

    let values = [val1, val2, val3];

    let maxVal = max(values);
    let minVal = min(values);

    document.getElementById("maximum").innerHTML = "Max: " + maxVal;
    document.getElementById("minimum").innerHTML = "Min: " + minVal;
    document.getElementById("mean").innerHTML = "Mean: " + mean(values);
    document.getElementById("median").innerHTML = "Median: " + median(values);
    document.getElementById("range").innerHTML = "Range: " + (maxVal - minVal);
}