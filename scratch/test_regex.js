const containerText = "[TEST] High Traffic SimulationThis is a simulated high traffic dialog to test the Auto-Retry feature.Retry";
const errorPatterns = [
  /high\s*traffic/i,
  /server\s*(is\s*)?busy/i
];

const matches = errorPatterns.some(p => p.test(containerText));
console.log("Matches:", matches);
