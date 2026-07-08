const sky = document.querySelector(".sky");

window.addEventListener("pageshow", () => {
  document.body.classList.add("page-ready");
  document.body.classList.remove("page-leaving");
});

if (sky) {
  const colors = ["#44d17a", "#ffc857", "#48d8ff", "#f3f8ef"];
  for (let i = 0; i < 36; i += 1) {
    const bit = document.createElement("span");
    bit.style.setProperty("--x", `${Math.random() * 100}%`);
    bit.style.setProperty("--y", `${Math.random() * 100}%`);
    bit.style.setProperty("--s", `${6 + Math.random() * 12}px`);
    bit.style.setProperty("--mx", `${-30 + Math.random() * 60}px`);
    bit.style.setProperty("--my", `${-26 + Math.random() * 52}px`);
    bit.style.setProperty("--d", `${4 + Math.random() * 8}s`);
    bit.style.setProperty("--c", colors[Math.floor(Math.random() * colors.length)]);
    sky.appendChild(bit);
  }
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(value);
      const old = button.textContent;
      button.textContent = "OK";
      window.setTimeout(() => {
        button.textContent = old;
      }, 1200);
    } catch {
      button.textContent = "CTRL+C";
    }
  });
});

document.querySelectorAll("iframe[data-src]").forEach((frame) => {
  if (window.location.protocol !== "file:") {
    frame.setAttribute("src", frame.getAttribute("data-src"));
  }
});

document.querySelectorAll("a[href]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http") || link.target === "_blank") {
      return;
    }

    event.preventDefault();
    document.body.classList.add("page-leaving");
    window.setTimeout(() => {
      window.location.href = href;
    }, 260);
  });
});
