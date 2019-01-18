async function main() {
  const req = await fetch('/templates.json');
  const data = await req.json();

  console.log(data);
}

main();
