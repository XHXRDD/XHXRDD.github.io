// The autoComplete.js Engine instance creator
const autoCompleteJS = new autoComplete({
  data: {
    src: async () => {
      try {
        // Loading placeholder text
        document.getElementById("autoComplete").setAttribute("placeholder", "Loading...");
        // Fetch External Data Source
        const source = await fetch("https://zettathings.top/stocklist.json");
        const data = await source.json();
        // Post Loading placeholder text
        document.getElementById("autoComplete").setAttribute("placeholder", autoCompleteJS.placeHolder);
        // Returns Fetched data
        return data;
      } catch (error) {
        return error;
      }
    },
    keys: ["code","name","jp"],
    cache: true,
    filter: (list) => {
      // Filter duplicates
      // incase of multiple data keys usage
      const filteredResults = Array.from(new Set(list.map((value) => value.match))).map((name) => {
        return list.find((value) => value.match === name);

     });

      return filteredResults;
    },
  },
  placeHolder: "Search for stocks",
  resultsList: {
    element: (list, data) => {
      const info = document.createElement("p");
      if (data.results.length) {
        info.innerHTML = `Displaying <strong>${data.results.length}</strong> out of <strong>${data.matches.length}</strong> results`;
      } else {
        info.innerHTML = `Found <strong>${data.matches.length}</strong> matching results for <strong>"${data.query}"</strong>`;
      }
      list.prepend(info);
    },
    noResults: true,
    maxResults: 15,
    tabSelect: true,
  },
  resultItem: {
    element: (item, data) => {
      // Modify Results Item Style
      item.style = "display: flex; justify-content: space-between;";
      // Modify Results Item Content
      item.innerHTML = `
     <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
      ${ data.match }
      </span>
      <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
       ${data.value.code}
      </span>
      <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
       ${data.value.name}
      </span>
      <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
       ${data.value.jp}
      </span>`;
    },
    highlight: true,
  },
  events: {
    input: {
      focus() {
        if (autoCompleteJS.input.value.length) autoCompleteJS.start();
      },
      selection(event) {
        const feedback = event.detail;
        autoCompleteJS.input.blur();
        // Prepare User's Selected Value
        const selection = feedback.selection.value[feedback.selection.key];
        // Render selected choice to selection div
        //document.querySelector(".selection").innerHTML = feedback.selection.value.code;
        // Replace Input value with the selected value
        //autoCompleteJS.input.value = feedback.selection.value.code;
        // Console log autoComplete data feedback
        //console.log(feedback);


        let x = feedback.selection.value.code;
        let text;
        if (x.length < 6) {
          text = "请输入6位代码";
        }
        else if (isNaN(x) || x < 1 || x > 699999) {
          text = "无效A股代码";
        }
        else {
          if (x > 0 && x < 400000) {
            text = "深市A股";
            url = "https://zettathings.top/public/webhqchart.demo/demo/RXZT.html?&symbol=" + x + ".sz";
            window.open(url, "_blank", "");
            var ifra = document.getElementById("content-right-up");
            ifra.src = url;
            ifra.reload();

          }
          else if (x > 599999 && x < 690000) {
            text = "沪市A股";
            url = "https://zettathings.top/public/webhqchart.demo/demo/RXZT.html?&symbol=" + x + ".sh";
            window.open(url, "_blank", "");
            var ifra = document.getElementById("content-right-up");
            ifra.src = url;
            ifra.reload();

          }
          else
            text = "无效A股代码";
        }
        //document.getElementById("demo").innerHTML = text;

      },
    },
  },
});

// Toggle Search Engine Type/Mode
document.querySelector(".toggler").addEventListener("click", () => {
  // Holds the toggle button selection/alignment
  const toggle = document.querySelector(".toggle").style.justifyContent;

  if (toggle === "flex-start" || toggle === "") {
    // Set Search Engine mode to Loose
    document.querySelector(".toggle").style.justifyContent = "flex-end";
    document.querySelector(".toggler").innerHTML = "Loose";
    autoCompleteJS.searchEngine = "loose";
  } else {
    // Set Search Engine mode to Strict
    document.querySelector(".toggle").style.justifyContent = "flex-start";
    document.querySelector(".toggler").innerHTML = "Strict";
    autoCompleteJS.searchEngine = "strict";
  }
});

// Blur/unBlur page elements
const action = (action) => {
  const github = document.querySelector(".github-corner");
  const title = document.querySelector("h1");
  const mode = document.querySelector(".mode");
  const selection = document.querySelector(".selection");
  const footer = document.querySelector(".footer");

  if (action === "dim") {
    github.style.opacity = 1;
    title.style.opacity = 1;
    mode.style.opacity = 1;
    selection.style.opacity = 1;
    footer.style.opacity = 1;
  } else {
    github.style.opacity = 0.1;
    title.style.opacity = 0.3;
    mode.style.opacity = 0.2;
    selection.style.opacity = 0.1;
    footer.style.opacity = 0.1;
  }
};

// Blur/unBlur page elements on input focus
["focus", "blur"].forEach((eventType) => {
  autoCompleteJS.input.addEventListener(eventType, () => {
    // Blur page elements
    if (eventType === "blur") {
      action("dim");
    } else if (eventType === "focus") {
      // unBlur page elements
      action("light");
    }
  });
});
