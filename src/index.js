import { SlimeMold } from "./SlimeMold.js";

const main = async () => {
  const slimeMold = new SlimeMold(document.querySelector("#canvas"));
  slimeMold.start();
};

main();
