import { SlimeMold } from "./SlimeMold.js";

const main = async () => {
  const slimeMold = new SlimeMold(document.querySelector("#canvas"), './src/shaders');
  slimeMold.start();
  window.slimeMold = slimeMold;
};

main();
