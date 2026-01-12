"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigFilepath = exports.getCredentialsFilepath = exports.getHomeDir = exports.ENV_CREDENTIALS_PATH = void 0;
exports.GetCredentials = GetCredentials;
exports.GetGlueJobList = GetGlueJobList;
exports.StartGlueJobRun = StartGlueJobRun;
exports.RestartGlueJobRun = RestartGlueJobRun;
exports.GetLatestLogGroupLogStreamList = GetLatestLogGroupLogStreamList;
exports.GetLogEvents = GetLogEvents;
exports.TestAwsCredentials = TestAwsCredentials;
exports.TestAwsConnection = TestAwsConnection;
exports.GetAwsProfileList = GetAwsProfileList;
exports.getIniProfileData = getIniProfileData;
exports.isJsonString = isJsonString;
exports.GetGlueJobRuns = GetGlueJobRuns;
exports.GetGlueJobRun = GetGlueJobRun;
exports.StopGlueJobRun = StopGlueJobRun;
exports.GetGlueJobDescription = GetGlueJobDescription;
exports.DownloadS3Object = DownloadS3Object;
exports.UploadS3Object = UploadS3Object;
/* eslint-disable @typescript-eslint/naming-convention */
const credential_providers_1 = require("@aws-sdk/credential-providers");
const client_glue_1 = require("@aws-sdk/client-glue");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_cloudwatch_logs_1 = require("@aws-sdk/client-cloudwatch-logs");
const client_sts_1 = require("@aws-sdk/client-sts");
const ui = require("./UI");
const MethodResult_1 = require("./MethodResult");
const os_1 = require("os");
const path_1 = require("path");
const path_2 = require("path");
const parseKnownFiles_1 = require("../aws-sdk/parseKnownFiles");
const GlueTreeView = require("../glue/GlueTreeView");
async function GetCredentials() {
    let credentials;
    try {
        if (GlueTreeView.GlueTreeView.Current) {
            process.env.AWS_PROFILE = GlueTreeView.GlueTreeView.Current.AwsProfile;
        }
        const provider = (0, credential_providers_1.fromNodeProviderChain)({ ignoreCache: true });
        credentials = await provider();
        if (!credentials) {
            throw new Error("Aws credentials not found !!!");
        }
        ui.logToOutput("Aws credentials AccessKeyId=" + credentials.accessKeyId);
        return credentials;
    }
    catch (error) {
        ui.showErrorMessage("Aws Credentials Not Found !!!", error);
        ui.logToOutput("GetCredentials Error !!!", error);
        return credentials;
    }
}
async function GetGlueClient(region) {
    const credentials = await GetCredentials();
    const glueClient = new client_glue_1.GlueClient({
        region,
        credentials,
        endpoint: GlueTreeView.GlueTreeView.Current?.AwsEndPoint,
    });
    return glueClient;
}
async function GetCloudWatchClient(region) {
    const credentials = await GetCredentials();
    const cloudwatchLogsClient = new client_cloudwatch_logs_1.CloudWatchLogsClient({
        region,
        credentials,
        endpoint: GlueTreeView.GlueTreeView.Current?.AwsEndPoint,
    });
    return cloudwatchLogsClient;
}
async function GetSTSClient(region) {
    const credentials = await GetCredentials();
    const stsClient = new client_sts_1.STSClient({
        region,
        credentials,
        endpoint: GlueTreeView.GlueTreeView.Current?.AwsEndPoint,
    });
    return stsClient;
}
async function GetS3Client(region) {
    const credentials = await GetCredentials();
    const s3Client = new client_s3_1.S3Client({
        region,
        credentials,
        endpoint: GlueTreeView.GlueTreeView.Current?.AwsEndPoint,
        forcePathStyle: true,
    });
    return s3Client;
}
async function GetGlueJobList(region, filter) {
    let result = new MethodResult_1.MethodResult();
    result.result = [];
    try {
        const glue = await GetGlueClient(region);
        let nextToken = undefined;
        do {
            const cmd = new client_glue_1.GetJobsCommand({ MaxResults: 100, NextToken: nextToken });
            const res = await glue.send(cmd);
            if (res.Jobs) {
                for (const job of res.Jobs) {
                    if (!filter || job.Name?.includes(filter)) {
                        result.result.push(job.Name ?? "");
                    }
                }
            }
            nextToken = res.NextToken;
        } while (nextToken);
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.GetGlueJobList Error !!!", error);
        return result;
    }
}
async function StartGlueJobRun(region, jobName, parameters) {
    let result = new MethodResult_1.MethodResult();
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.StartJobRunCommand({ JobName: jobName, Arguments: parameters });
        const res = await glue.send(cmd);
        result.result = res.JobRunId ?? "";
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.StartGlueJobRun Error !!!", error);
        return result;
    }
}
async function RestartGlueJobRun(region, jobName, jobRunId) {
    let result = new MethodResult_1.MethodResult();
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.StartJobRunCommand({ JobName: jobName, JobRunId: jobRunId });
        const res = await glue.send(cmd);
        result.result = res.JobRunId ?? "";
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.RestartGlueJobRun Error !!!", error);
        return result;
    }
}
async function GetLatestLogGroupLogStreamList(Region, LogGroupName) {
    let result = new MethodResult_1.MethodResult();
    result.result = [];
    try {
        const cloudwatchlogs = await GetCloudWatchClient(Region);
        const describeLogStreamsCommand = new client_cloudwatch_logs_1.DescribeLogStreamsCommand({
            logGroupName: LogGroupName,
            orderBy: "LastEventTime",
            descending: true,
            limit: 30,
        });
        const streamsResponse = await cloudwatchlogs.send(describeLogStreamsCommand);
        if (streamsResponse.logStreams) {
            result.result = streamsResponse.logStreams.map(stream => stream.logStreamName || 'invalid log stream');
        }
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function GetLogEvents(Region, LogGroupName, LogStreamName) {
    let result = new MethodResult_1.MethodResult();
    result.result = [];
    try {
        const cloudwatchlogs = await GetCloudWatchClient(Region);
        const getLogEventsCommand = new client_cloudwatch_logs_1.GetLogEventsCommand({
            logGroupName: LogGroupName,
            logStreamName: LogStreamName,
            limit: 50,
            startFromHead: true,
        });
        const eventsResponse = await cloudwatchlogs.send(getLogEventsCommand);
        if (eventsResponse.events) {
            result.result = eventsResponse.events;
        }
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function TestAwsCredentials() {
    let result = new MethodResult_1.MethodResult();
    try {
        await GetCredentials();
        result.isSuccessful = true;
        result.result = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function TestAwsConnection(Region = "us-east-1") {
    let result = new MethodResult_1.MethodResult();
    try {
        const sts = await GetSTSClient(Region);
        const command = new client_sts_1.GetCallerIdentityCommand({});
        await sts.send(command);
        result.isSuccessful = true;
        result.result = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function GetAwsProfileList() {
    let result = new MethodResult_1.MethodResult();
    try {
        let profileData = await getIniProfileData();
        result.result = Object.keys(profileData);
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function getIniProfileData(init = {}) {
    const profiles = await (0, parseKnownFiles_1.parseKnownFiles)(init);
    return profiles;
}
exports.ENV_CREDENTIALS_PATH = "AWS_SHARED_CREDENTIALS_FILE";
const getHomeDir = () => {
    const { HOME, USERPROFILE, HOMEPATH, HOMEDRIVE = `C:${path_1.sep}` } = process.env;
    if (HOME) {
        return HOME;
    }
    if (USERPROFILE) {
        return USERPROFILE;
    }
    if (HOMEPATH) {
        return `${HOMEDRIVE}${HOMEPATH}`;
    }
    return (0, os_1.homedir)();
};
exports.getHomeDir = getHomeDir;
const getCredentialsFilepath = () => process.env[exports.ENV_CREDENTIALS_PATH] || (0, path_2.join)((0, exports.getHomeDir)(), ".aws", "credentials");
exports.getCredentialsFilepath = getCredentialsFilepath;
const getConfigFilepath = () => process.env[exports.ENV_CREDENTIALS_PATH] || (0, path_2.join)((0, exports.getHomeDir)(), ".aws", "config");
exports.getConfigFilepath = getConfigFilepath;
function isJsonString(jsonString) {
    try {
        var json = JSON.parse(jsonString);
        return (typeof json === 'object');
    }
    catch (e) {
        return false;
    }
}
async function GetGlueJobRuns(region, jobName) {
    let result = new MethodResult_1.MethodResult();
    result.result = [];
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.GetJobRunsCommand({ JobName: jobName, MaxResults: 20 });
        const res = await glue.send(cmd);
        if (res.JobRuns) {
            result.result = res.JobRuns;
        }
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.GetGlueJobRuns Error !!!", error);
        return result;
    }
}
async function GetGlueJobRun(region, jobName, jobRunId) {
    let result = new MethodResult_1.MethodResult();
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.GetJobRunCommand({ JobName: jobName, RunId: jobRunId, PredecessorsIncluded: true });
        const res = await glue.send(cmd);
        result.result = res.JobRun;
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.GetGlueJobRun Error !!!", error);
        return result;
    }
}
async function StopGlueJobRun(region, jobName, jobRunId) {
    let result = new MethodResult_1.MethodResult();
    result.result = [];
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.BatchStopJobRunCommand({ JobName: jobName, JobRunIds: [jobRunId] });
        const res = await glue.send(cmd);
        const stopped = res.SuccessfulSubmissions?.map(s => s?.JobRunId ?? '')?.filter(id => id) ?? [];
        result.result = stopped;
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.StopGlueJobRun Error !!!", error);
        return result;
    }
}
async function GetGlueJobDescription(region, jobName) {
    let result = new MethodResult_1.MethodResult();
    try {
        const glue = await GetGlueClient(region);
        const cmd = new client_glue_1.GetJobCommand({ JobName: jobName }); // Glue doesn't have a simple DescribeJob, GetJobs works
        const res = await glue.send(cmd);
        const job = res.Job || {};
        result.result = job;
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        return result;
    }
}
async function streamToBuffer(body) {
    if (!body)
        return new Uint8Array();
    if (typeof body.transformToByteArray === 'function') {
        return await body.transformToByteArray();
    }
    return await new Promise((resolve, reject) => {
        const chunks = [];
        body.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        body.on('end', () => resolve(Buffer.concat(chunks)));
        body.on('error', reject);
    });
}
async function DownloadS3Object(region, bucket, key) {
    let result = new MethodResult_1.MethodResult();
    try {
        const s3 = await GetS3Client(region);
        const res = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key }));
        const data = await streamToBuffer(res.Body);
        result.result = data;
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.DownloadS3Object Error !!!", error);
        return result;
    }
}
async function UploadS3Object(region, bucket, key, content) {
    let result = new MethodResult_1.MethodResult();
    try {
        const s3 = await GetS3Client(region);
        await s3.send(new client_s3_1.PutObjectCommand({ Bucket: bucket, Key: key, Body: content }));
        result.isSuccessful = true;
        return result;
    }
    catch (error) {
        result.isSuccessful = false;
        result.error = error;
        ui.logToOutput("api.UploadS3Object Error !!!", error);
        return result;
    }
}
//# sourceMappingURL=API.js.map