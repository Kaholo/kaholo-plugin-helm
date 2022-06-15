const {
  bootstrap,
  helpers,
} = require("@kaholo/plugin-library");
const helmCli = require("./helm-cli");

async function install(pluginParameters) {
  const { kubeCertificate } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      result = await helmCli.install({
        ...pluginParameters,
        certificateFilePath,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

async function uninstall(pluginParameters) {
  const { kubeCertificate } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      result = await helmCli.uninstall({
        ...pluginParameters,
        certificateFilePath,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

async function runCommand(pluginParameters) {
  const {
    kubeCertificate,
  } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      result = await helmCli.runCommand({
        ...pluginParameters,
        certificateFilePath,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

module.exports = bootstrap({
  install,
  uninstall,
  runCommand,
});
