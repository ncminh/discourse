const args = process.argv.slice(2);

if (args.length < 1 || args.length > 2) {
  console.log("Expecting: node {smoke_test.js} {url}");
  process.exit(1);
}

const url = args[0];

console.log(`Starting Discourse Smoke Test for ${url}`);

const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    // slowMo: 10,
    args: ["--disable-local-storage"]
  });
  const page = await browser.newPage();

  page.setViewport = {
    width: 1366,
    height: 768
  };

  const exec = (description, fn, assertion) => {
    const start = +new Date();

    return fn.call().then(output => {
      if (assertion) {
        if (assertion.call(this, output)) {
          console.log(`PASSED: ${description} - ${(+new Date()) - start}ms`);
        } else {
          console.log(`FAILED: ${description} - ${(+new Date()) - start}ms`);
          console.log("SMOKE TEST FAILED");
          process.exit(1);
        }
      } else {
        console.log(`PASSED: ${description} - ${(+new Date()) - start}ms`);
      }
    }).catch(error => {
      console.log(`ERROR (${description}): ${error.message} - ${(+new Date()) - start}ms`);
      console.log("SMOKE TEST FAILED");
      process.exit(1);
    });
  };

  const assert = (description, fn, assertion) => {
    return exec(description, fn, assertion);
  };

  page.on('console', msg => console.log(`PAGE LOG: ${msg.text}`));

  await exec("go to site", () => {
    return page.goto(url);
  });

  await exec("expect a log in button in the header", () => {
    return page.waitForSelector("header .login-button", { visible: true });
  });

  await exec("go to latest page", () => {
    return page.goto(path.join(url, 'latest'));
  });

  await exec("at least one topic shows up", () => {
    return page.waitForSelector(".topic-list tbody tr", { visible: true });
  });

  await exec("go to categories page", () => {
    return page.goto(path.join(url, 'categories'));
  });

  await exec("can see categories on the page", () => {
    return page.waitForSelector(".category-list", { visible: true });
  });

  await exec("navigate to 1st topic", () => {
    return page.click(".main-link a.title:first-of-type");
  });

  await exec("at least one post body", () => {
    return page.waitForSelector(".topic-post", { visible: true });
  });

  await exec("click on the 1st user", () => {
    return page.click(".topic-meta-data a:first-of-type");
  });

  await exec("user has details", () => {
    return page.waitForSelector("#user-card .names", { visible: true });
  });

  if (!process.env.READONLY_TESTS) {
    await exec("open login modal", () => {
      return page.click(".login-button");
    });

    await exec("login modal is open", () => {
      return page.waitForSelector(".login-modal", { visible: true });
    });

    await exec("type in credentials & log in", () => {
      let promise = page.type("#login-account-name", process.env.DISCOURSE_USERNAME || 'smoke_user');

      promise = promise.then(() => {
        return page.type("#login-account-password", process.env.DISCOURSE_PASSWORD || 'P4ssw0rd');
      });

      promise = promise.then(() => {
        return page.click(".login-modal .btn-primary");
      });

      return promise;
    });

    await exec("is logged in", () => {
      return page.waitForSelector(".current-user", { visible: true });
    });

    await exec("go home", () => {
      return page.click("#site-logo, #site-text-logo");
    });

    await exec("it shows a topic list", () => {
      return page.waitForSelector(".topic-list", { visible: true });
    });

    await exec("we have a create topic button", () => {
      return page.waitForSelector("#create-topic", { visible: true });
    });

    await exec("open composer", () => {
      return page.click("#create-topic");
    });

    await exec("the editor is visible", () => {
      return page.waitForFunction(
        "document.activeElement === document.getElementById('reply-title')"
      );
    });

    await exec("compose new topic", () => {
      const date = `(${(+new Date())})`;
      const title = `This is a new topic ${date}`;
      const post = `I can write a new topic inside the smoke test! ${date} \n\n`;

      let promise = page.type("#reply-title", title);

      promise = promise.then(() => {
        return page.type("#reply-control .d-editor-input", post);
      });

      return promise;
    });

    await exec("updates preview", () => {
      return page.waitForSelector(".d-editor-preview p", { visible: true });
    });

    await exec("open upload modal", () => {
      return page.click(".d-editor-button-bar .upload");
    });

    await exec("upload modal is open", () => {
      let promise = page.waitForSelector("#filename-input", { visible: true });

      promise.then(() => {
        return page.click(".d-modal-cancel");
      });

      return promise;
    });

    await exec("submit the topic", () => {
      return page.click(".submit-panel .create");
    });

    await exec("topic is created", () => {
      return page.waitForSelector(".fancy-title", { visible: true });
    });

    await exec("open the composer", () => {
      return page.click(".post-controls:first-of-type .create");
    });

    await exec("composer is open", () => {
      return page.waitForSelector("#reply-control .d-editor-input", { visible: true });
    });

    await exec("compose reply", () => {
      const post = `I can even write a reply inside the smoke test ;) (${(+new Date())})`;
      return page.type("#reply-control .d-editor-input", post);
    });

    await assert("waiting for the preview", () => {
      let promise = page.waitForSelector(".d-editor-preview p",
        { visible: true }
      );

      promise = promise.then(() => {
        return page.evaluate(() => {
          return document.querySelector(".d-editor-preview").innerText;
        });
      });

      return promise;
    }, output => {
      return output.match("I can even write a reply");
    });

    await exec("submit the topic", () => {
      return page.click("#reply-control .create");
    });

    await assert("reply is created", () => {
      let promise = page.waitForSelector(".topic-post");

      promise = promise.then(() => {
        return page.evaluate(() => {
          return document.querySelectorAll(".topic-post").length;
        });
      });

      return promise;
    }, output => {
      return output === 2;
    });
  }

  await browser.close();

  console.log("ALL PASSED");
})();
