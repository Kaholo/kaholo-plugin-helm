const {
  bootstrap,
  helpers,
} = require("@kaholo/plugin-library");
const decodeJwt = require("jwt-decode");

const helmCli = require("./helm-cli");

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

function extractUserFromJWT(token) {
  const decodedData = decodeJwt(token);

  const user = decodedData?.sub;
  if (!user) {
    throw new Error(
      "Failed to extract kube-user from kube-token. "
      + "The token doesn't contain kube-user.",
    );
  }

  return user;
}

function validateCertificate(certificate) {
  if (!certificate.startsWith("-----BEGIN CERTIFICATE-----")) {
    return Buffer.from(certificate, "base64").toString();
  }

  return certificate;
}

module.exports = bootstrap({
  install,
  uninstall,
  runCommand,
});
