const {
  docker,
} = require("@kaholo/plugin-library");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const path = require("path");

const HELM_CLI_NAME = "helm";
const HELM_IMAGE_NAME = "alpine/helm";

async function install(parameters) {
  const {
    certificateFilePath,
    kubeToken,
    kubeApiServer,
    kubeUser,
    namespace,
    chartDirectory,
    releaseName,
    valuesOverride,
  } = parameters;

  const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
  const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
  const chartVolumeDefinition = docker.createVolumeDefinition(chartDirectory);
  const volumeDefinitions = [
    certificateVolumeDefinition,
    chartVolumeDefinition,
  ];

  const authenticationParameters = [
    "--kube-ca-file", "$KUBE_CA_FILE",
    "--kube-token", "$KUBE_TOKEN",
    "--kube-apiserver", "$KUBE_APISERVER",
    "--kube-as-user", "$KUBE_USER",
  ];

  const releaseNameParameter = releaseName || "--generate-name";

  const installationParameters = generateInstallationParameters({
    namespace,
    valuesOverride,
  });

  const dockerEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.mountPoint.name]: cur.mountPoint.value,
    }),
    {},
  );

  const shellEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.path.name]: cur.path.value,
    }),
    {
      KUBE_CA_FILE: `${certificateVolumeDefinition.mountPoint.value}/${certificateFileName}`,
      KUBE_TOKEN: kubeToken,
      KUBE_APISERVER: kubeApiServer,
      KUBE_USER: kubeUser,
      ...dockerEnvironmentalVariables,
    },
  );

  const helmCommand = `\
install \
${releaseNameParameter} \
$${chartVolumeDefinition.mountPoint.name} \
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

  const command = docker.buildDockerCommand({
    command: helmCommand,
    image: HELM_IMAGE_NAME,
    environmentVariables: dockerEnvironmentalVariables,
    volumeDefinitionsArray: volumeDefinitions,
  });

  return exec(command, {
    env: shellEnvironmentalVariables,
  });
}

async function uninstall(parameters) {
  const {
    certificateFilePath,
    kubeToken,
    kubeApiServer,
    kubeUser,
    namespace,
    releaseName,
  } = parameters;

  const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
  const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
  const volumeDefinitions = [
    certificateVolumeDefinition,
  ];

  const authenticationParameters = [
    "--kube-ca-file", "$KUBE_CA_FILE",
    "--kube-token", "$KUBE_TOKEN",
    "--kube-apiserver", "$KUBE_APISERVER",
    "--kube-as-user", "$KUBE_USER",
  ];

  const installationParameters = generateInstallationParameters({
    namespace,
  });

  const dockerEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.mountPoint.name]: cur.mountPoint.value,
    }),
    {},
  );

  const shellEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.path.name]: cur.path.value,
    }),
    {
      KUBE_CA_FILE: `${certificateVolumeDefinition.mountPoint.value}/${certificateFileName}`,
      KUBE_TOKEN: kubeToken,
      KUBE_APISERVER: kubeApiServer,
      KUBE_USER: kubeUser,
      ...dockerEnvironmentalVariables,
    },
  );

  const helmCommand = `\
uninstall \
${releaseName} \
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

  const command = docker.buildDockerCommand({
    command: helmCommand,
    image: HELM_IMAGE_NAME,
    environmentVariables: dockerEnvironmentalVariables,
    volumeDefinitionsArray: volumeDefinitions,
  });

  return exec(command, {
    env: shellEnvironmentalVariables,
  });
}

async function runCommand(parameters) {
  const {
    certificateFilePath,
    kubeToken,
    kubeApiServer,
    kubeUser,
    command,
    namespace,
  } = parameters;

  const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
  const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
  const volumeDefinitions = [
    certificateVolumeDefinition,
  ];

  const authenticationParametersMap = new Map([
    ["--kube-ca-file", `${certificateVolumeDefinition.mountPoint.value}/${certificateFileName}`],
    ["--kube-token", kubeToken],
    ["--kube-apiserver", kubeApiServer],
    ["--kube-as-user", kubeUser],
  ]);

  const additionalParametersMap = new Map();
  if (namespace) {
    additionalParametersMap.set("--namespace", namespace);
  }

  const sanitizedParametersMap = sanitizeParameters(
    command,
    authenticationParametersMap,
    additionalParametersMap,
  );
  // eslint-disable-next-line max-len
  const parametersWithEnvironmentalVariablesArray = paramsMapToParamsWithEnvironmentalVariablesArray(
    sanitizedParametersMap,
  );
  const environmentalVariablesContainingParametersObject = paramsMapToEnvironmentalVariablesObject(
    sanitizedParametersMap,
  );

  const dockerEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.mountPoint.name]: cur.mountPoint.value,
    }),
    {},
  );

  const shellEnvironmentalVariables = volumeDefinitions.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.path.name]: cur.path.value,
    }),
    {
      ...dockerEnvironmentalVariables,
      ...environmentalVariablesContainingParametersObject,
    },
  );

  const helmCommand = `\
${sanitizeCommand(command)} \
${parametersWithEnvironmentalVariablesArray.join(" ")}`;

  const completeCommand = docker.buildDockerCommand({
    command: helmCommand,
    image: HELM_IMAGE_NAME,
    environmentVariables: dockerEnvironmentalVariables,
    volumeDefinitionsArray: volumeDefinitions,
  });

  return exec(completeCommand, {
    env: shellEnvironmentalVariables,
  });
}

function generateInstallationParameters(pluginParams) {
  const {
    namespace,
    valuesOverrides,
  } = pluginParams;

  const params = [];

  if (namespace) {
    params.push("--namespace", namespace);
  }

  if (valuesOverrides) {
    params.push(...valuesOverrides.map((override) => ["--set", override]).flat());
  }

  return params;
}

function splitDirectory(directory) {
  return [
    path.dirname(directory),
    path.basename(directory),
  ];
}

// Helm Docker image accepts commands WITHOUT the CLI name
function sanitizeCommand(command) {
  return command.startsWith(HELM_CLI_NAME)
    ? command.slice(HELM_CLI_NAME.length).trim()
    : command;
}

function sanitizeParameters(command, authorizationParamsMap, additionalParamsMap) {
  const sanitizedParameters = new Map();

  authorizationParamsMap.forEach((value, key) => {
    if (!command.includes(key)) {
      sanitizedParameters.set(key, value);
    }
  });

  additionalParamsMap.forEach((value, key) => {
    if (!command.includes(key)) {
      sanitizedParameters.set(key, value);
    }
  });

  return sanitizedParameters;
}

function paramsMapToParamsWithEnvironmentalVariablesArray(paramsMap) {
  return Array.from(
    paramsMap,
    ([key]) => ([key, generateEnvironmentalVariableName(key)]),
  ).flat();
}

function paramsMapToEnvironmentalVariablesObject(paramsMap) {
  return Object.fromEntries(
    Array.from(
      paramsMap,
      ([key, value]) => ([generateEnvironmentalVariableName(key).substring(1), value]),
    ),
  );
}

function generateEnvironmentalVariableName(parameterName) {
  const regex = /-/g;

  let result = parameterName.replace(regex, "_");

  if (result.startsWith("_")) {
    result = result.substring(1);
  }

  if (result.startsWith("_")) {
    result = result.substring(1);
  }

  result = `$${result.toUpperCase()}`;

  return result;
}

module.exports = {
  install,
  uninstall,
  runCommand,
};
