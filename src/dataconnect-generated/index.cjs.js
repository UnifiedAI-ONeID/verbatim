const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'verbatim',
  location: 'us-west4'
};
exports.connectorConfig = connectorConfig;

const createNewTaskRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewTask', inputVars);
}
createNewTaskRef.operationName = 'CreateNewTask';
exports.createNewTaskRef = createNewTaskRef;

exports.createNewTask = function createNewTask(dcOrVars, vars) {
  return executeMutation(createNewTaskRef(dcOrVars, vars));
};

const getMyTasksRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyTasks');
}
getMyTasksRef.operationName = 'GetMyTasks';
exports.getMyTasksRef = getMyTasksRef;

exports.getMyTasks = function getMyTasks(dc) {
  return executeQuery(getMyTasksRef(dc));
};

const updateTaskRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateTask', inputVars);
}
updateTaskRef.operationName = 'UpdateTask';
exports.updateTaskRef = updateTaskRef;

exports.updateTask = function updateTask(dcOrVars, vars) {
  return executeMutation(updateTaskRef(dcOrVars, vars));
};

const deleteTaskRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteTask', inputVars);
}
deleteTaskRef.operationName = 'DeleteTask';
exports.deleteTaskRef = deleteTaskRef;

exports.deleteTask = function deleteTask(dcOrVars, vars) {
  return executeMutation(deleteTaskRef(dcOrVars, vars));
};
