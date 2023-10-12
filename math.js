// formulas were taken from various sources on the web, including https://www.cuemath.com/mean-median-mode-formula/ //



function calculate() {

    let val1 = Number(document.getElementById("firstnumber").value);
    let val2 = Number(document.getElementById("secondnumber").value);
    let val3 = Number(document.getElementById("thirdnumber").value);

    let values = [val1, val2, val3];

    let maxVal = max(values);
    let minVal = min(values);

    document.getElementById("maximum").innerHTML = "Max: " + maxVal;
    document.getElementById("minimum").innerHTML = "Min: " + minVal;
    document.getElementById("mean").innerHTML = "Mean: " + mean(values);
    document.getElementById("median").innerHTML = "Median: " + median(values);
    document.getElementById("range").innerHTML = "Range: " + (maxVal - minVal);
}

//finding the largest number

function max(inNum) {
    let max = inNum[0];

    for (let i = 0; i < inNum.length; i++) {
        if (inNum[i] >= max) {
            max = inNum[i];
        }
    }
    return max;
}


//finding the smallest number

function min(inNum) {
    let min = inNum[0];

    for (let i = 0; i < inNum.length; i++) {
        if (inNum[i] < min) {
            min = inNum[i];
        }
    }
    return min;
}

//finding the mean of the numbers


function mean(inNum) {
    let sum = 0;

    for (let num of inNum) {
        sum += num;
    }

    return Math.floor(sum / inNum.length);
}


//finding the median of the numbers

function median(inNum) {
    arr = inNum.sort ((a,b) => a - b);

    if (inNum.length %2 !== 0 ) {
    return inNum[Math.floor(inNum.length / 2)];
    }   
    else {
        let mid1 = inNum[inNum.length / 2];
        let mid2 = inNum[inNum.length / 2 - 1];
        return (mid1 + mid2) / 2;
    }
}

//function range(inNum) {}

