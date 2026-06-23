# diverse feedback LLM

### Install the dependencies

```bash
yarn
# or
npm install
```

#### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

#### GitHub Gist 配置

公开 Gist 的读取现在不再依赖内置 token。

如果你需要：

- 读取私有 Gist
- 修改 Gist 内容

请在项目根目录创建 `.env`，并参考 `.env.example` 配置：

```bash
VITE_GITHUB_TOKEN=your_github_pat
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_BIGMODEL_API_KEY=your_bigmodel_api_key
```

也可以在浏览器控制台临时设置：

```js
localStorage.setItem("github_pat", "your_github_pat");
```

#### Lint the files

```bash
yarn lint
# or
npm run lint
```

#### Format the files

```bash
yarn format
# or
npm run format
```

#### Build the app for production

```bash
quasar build
```

#### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
