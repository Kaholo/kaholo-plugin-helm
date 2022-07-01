const {
  bootstrap,
  helpers,
} = require("@kaholo/plugin-library");

const helmCli = require("./helm-cli");
const {
  extractUserFromJWT,
  validateCertificate,
} = require("./params-helpers");

async function install(pluginParameters) {
  const {
    kubeCertificate,
    kubeToken,
  } = pluginParameters;
  const kubeUser = extractUserFromJWT(kubeToken);
  const validatedCertificate = validateCertificate(kubeCertificate);

  let result;

  await helpers.temporaryFileSentinel(
    [validatedCertificate],
    async (certificateFilePath) => {
      result = await helmCli.install({
        ...pluginParameters,
        certificateFilePath,
        kubeUser,
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
  const {
    kubeCertificate,
    kubeToken,
  } = pluginParameters;
  const kubeUser = extractUserFromJWT(kubeToken);
  const validatedCertificate = validateCertificate(kubeCertificate);

  let result;

  await helpers.temporaryFileSentinel(
    [validatedCertificate],
    async (certificateFilePath) => {
      result = await helmCli.uninstall({
        ...pluginParameters,
        certificateFilePath,
        kubeUser,
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
    kubeToken,
  } = pluginParameters;
  const kubeUser = extractUserFromJWT(kubeToken);
  const validatedCertificate = validateCertificate(kubeCertificate);

  let result;

  await helpers.temporaryFileSentinel(
    [validatedCertificate],
    async (certificateFilePath) => {
      result = await helmCli.runCommand({
        ...pluginParameters,
        certificateFilePath,
        kubeUser,
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
