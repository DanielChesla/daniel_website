function calculateAmortization() {
    const principal = parseFloat(document.getElementById("principal").value);
    const annualInterest = parseFloat(document.getElementById("interest").value) / 100;
    const termInYears = parseInt(document.getElementById("term").value);
    const numberOfPayments = termInYears * 12;
    const monthlyInterestRate = annualInterest / 12;
    const monthlyPayment = (principal * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments));

    document.getElementById("monthly-payment").textContent = monthlyPayment.toFixed(2);

    const amortizationTable = document.getElementById("amortization-schedule");
    amortizationTable.innerHTML = "<tr><th>Month</th><th>Payment</th><th>Principal Payment</th><th>Interest Payment</th><th>Remaining Balance</th></tr>";

    let remainingBalance = principal;
    let totalInterestPaid = 0;

    for (let month = 1; month <= numberOfPayments; month++) {
      const interestPayment = remainingBalance * monthlyInterestRate;
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;
      totalInterestPaid += interestPayment;

      amortizationTable.innerHTML += `<tr><td>${month}</td><td>$${monthlyPayment.toFixed(2)}</td><td>$${principalPayment.toFixed(2)}</td><td>$${interestPayment.toFixed(2)}</td><td>$${remainingBalance.toFixed(2)}</td></tr>`;
    }

    document.getElementById("total-interest").textContent = totalInterestPaid.toFixed(2);

    document.getElementById("results").style.display = "block";
  }

