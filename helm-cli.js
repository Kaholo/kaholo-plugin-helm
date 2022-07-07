const {
  docker,
  helpers,
} = require("@kaholo/plugin-library");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const path = require("path");

const HELM_CLI_NAME = "helm";
const HELM_IMAGE_NAME = "alpine/helm@sha256:5fa53042d50dacdcbea7eb093d014e1fb964bf5bf473d87ef03ca1a277121ebf";
const LOCAL_HELM_HOME_PATH = "/tmp/helmHome";
const TOKEN_REGEXP = /(HELM_KUBETOKEN=")([\w\d-.]+)?(")/;

async function install(parameters) {
  const {
    certificateFilePath,
    kubeToken,
    kubeApiServer,
    kubeUser,
    namespace,
    chartName,
    releaseName,
    valuesOverrides,
    workingDirectory,
  } = parameters;

  const additionalArguments = [
    "-v",
    `${LOCAL_HELM_HOME_PATH}:/root/`,
  ];

  const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
  const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
  const volumeDefinitions = [
    certificateVolumeDefinition,
  ];

  let chart = chartName;
  if (workingDirectory) {
    const absoluteWorkingDirectory = path.resolve(workingDirectory);

    const workingDirectoryVolumeDefinition = docker.createVolumeDefinition(
      absoluteWorkingDirectory,
    );
    volumeDefinitions.push(workingDirectoryVolumeDefinition);

    additionalArguments.push("-w", `$${workingDirectoryVolumeDefinition.mountPoint.name}`);
  } else if (chartName.startsWith("/") || chartName.startsWith("./")) {
    const absoluteChartPath = path.resolve(chartName);

    const [chartDirectory, pathChartName] = splitDirectory(absoluteChartPath);

    const chartVolumeDefinition = docker.createVolumeDefinition(chartDirectory);
    volumeDefinitions.push(chartVolumeDefinition);

    chart = `$${chartVolumeDefinition.mountPoint.name}/${pathChartName}`;
  }

  const authenticationParameters = [
    "--kube-ca-file", "$KUBE_CA_FILE",
    "--kube-token", "$KUBE_TOKEN",
    "--kube-apiserver", "$KUBE_APISERVER",
    "--kube-as-user", "$KUBE_USER",
  ];

  const releaseNameParameter = releaseName || "--generate-name";

  const installationParameters = generateInstallationParameters({
    namespace,
    valuesOverrides,
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
${chart} \
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

  const command = docker.buildDockerCommand({
    command: helmCommand,
    image: HELM_IMAGE_NAME,
    environmentVariables: dockerEnvironmentalVariables,
    volumeDefinitionsArray: volumeDefinitions,
    additionalArguments,
  });

  logToActivityLog(`Executing ${command}`);
  console.log("ENV", shellEnvironmentalVariables);

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

  logToActivityLog(`Executing ${command}`);

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
    workingDirectory,
  } = parameters;

  let { command } = parameters;

  const additionalArguments = [
    "-v",
    `${LOCAL_HELM_HOME_PATH}:/root/`,
  ];

  const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
  const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
  const volumeDefinitions = [
    certificateVolumeDefinition,
  ];

  // if a command uses a local chart, then we mount it to the docker
  const chartPath = extractChartPathFromCommand(command);
  if (workingDirectory) {
    const absoluteWorkingDirectory = path.resolve(workingDirectory);

    const workingDirectoryVolumeDefinition = docker.createVolumeDefinition(
      absoluteWorkingDirectory,
    );
    volumeDefinitions.push(workingDirectoryVolumeDefinition);

    additionalArguments.push("-w", `$${workingDirectoryVolumeDefinition.mountPoint.name}`);
  } else if (chartPath) {
    const absoluteChartPath = path.resolve(chartPath);

    const [chartDirectory, chartName] = splitDirectory(absoluteChartPath);
    const chartVolumeDefinition = docker.createVolumeDefinition(chartDirectory);
    volumeDefinitions.push(chartVolumeDefinition);

    command = command.replace(chartPath, `$${chartVolumeDefinition.mountPoint.name}/${chartName}`);
  }

  const authenticationParametersMap = new Map([
    ["--kube-ca-file", `${certificateVolumeDefinition.mountPoint.value}/${certificateFileName}`],
    ["--kube-token", kubeToken],
    ["--kube-apiserver", kubeApiServer],
    ["--kube-as-user", kubeUser],
  ]);

  const sanitizedParametersMap = sanitizeParameters(
    command,
    authenticationParametersMap,
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
    additionalArguments,
  });

  logToActivityLog(`Executing ${completeCommand}`);
  console.log("ENV", shellEnvironmentalVariables);
  const result = await exec(completeCommand, {
    env: shellEnvironmentalVariables,
  });

  return {
    stderr: result.stderr,
    stdout: redactTokenValue(result.stdout),
  };
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

function extractChartPathFromCommand(command) {
  const paths = helpers.extractPathsFromCommand(command);

  if (paths.length < 1 || !paths[0].path) {
    return null;
  }

  return paths[0].path;
}

function sanitizeParameters(command, authenticationParamsMap) {
  const sanitizedParameters = new Map();

  authenticationParamsMap.forEach((value, key) => {
    if (!command.includes(key)) {
      sanitizedParameters.set(key, value);
    }
  });

  return sanitizedParameters;
}

// Helm Docker image accepts commands WITHOUT the CLI name
function sanitizeCommand(command) {
  return command.startsWith(HELM_CLI_NAME)
    ? command.slice(HELM_CLI_NAME.length).trim()
    : command;
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

function redactTokenValue(str) {
  return str.replace(TOKEN_REGEXP, "$1redacted$3");
}

function logToActivityLog(message) {
  // TODO: Change console.error to console.info
  // Right now (Kaholo v4.3.2) console.info
  // does not print messages to Activity Log
  // Jira ticket: https://kaholo.atlassian.net/browse/KAH-3636
  console.error(message);
}

module.exports = {
  install,
  uninstall,
  runCommand,
};
