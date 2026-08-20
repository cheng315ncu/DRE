const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://discord.com/" });

global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;
global.HTMLElement = dom.window.HTMLElement;
global.BdApi = {
    Webpack: { getByKeys: () => ({}) },
    Data: { load: () => undefined, save: () => {} },
    DOM: { addStyle: () => {}, removeStyle: () => {} },
    Plugins: { folder: null },
};

process.env.NODE_ENV = "test";

module.exports = { dom };
