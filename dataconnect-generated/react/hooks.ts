
import {
  useDataConnectQuery,
  useDataConnectMutation,
  validateReactArgs,
} from '@tanstack-query-firebase/react/data-connect';
import {
  validateArgs,
  CallerSdkTypeEnum,
} from 'firebase/data-connect';
import {
  sessionsRef,
  sessionRef,
  createSessionRef,
  updateSessionRef,
  deleteSessionRef,
  generateSummaryRef,
  connectorConfig
} from '../esm/index.esm.js';

export function useSessions(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts } = validateReactArgs(
    connectorConfig,
    dcOrOptions,
    options,
  );
  const ref = sessionsRef(dcInstance);
  return useDataConnectQuery(ref, inputOpts, CallerSdkTypeEnum.GeneratedReact);
}

export function useSession(dcOrOptions, options) {
    const { dc: dcInstance, vars, options: inputOpts } = validateReactArgs(
        connectorConfig,
        dcOrOptions,
        options,
    );
    const ref = sessionRef(dcInstance, vars);
    return useDataConnectQuery(ref, inputOpts, CallerSdkTypeEnum.GeneratedReact);
}

export function useCreateSession(dcOrOptions, options) {
  const { dc: dcInstance, vars: inputOpts } = validateArgs(
    connectorConfig,
    dcOrOptions,
    options,
  );
  function refFactory(vars) {
    return createSessionRef(dcInstance, vars);
  }
  return useDataConnectMutation(
    refFactory,
    inputOpts,
    CallerSdkTypeEnum.GeneratedReact,
  );
}

export function useUpdateSession(dcOrOptions, options) {
  const { dc: dcInstance, vars: inputOpts } = validateArgs(
    connectorConfig,
    dcOrOptions,
    options,
  );
  function refFactory(vars) {
    return updateSessionRef(dcInstance, vars);
  }
  return useDataConnectMutation(
    refFactory,
    inputOpts,
    CallerSdkTypeEnum.GeneratedReact,
  );
}

export function useDeleteSession(dcOrOptions, options) {
  const { dc: dcInstance, vars: inputOpts } = validateArgs(
    connectorConfig,
    dcOrOptions,
    options,
  );
  function refFactory(vars) {
    return deleteSessionRef(dcInstance, vars);
  }
  return useDataConnectMutation(
    refFactory,
    inputOpts,
    CallerSdkTypeEnum.GeneratedReact,
  );
}

export function useGenerateSummary(dcOrOptions, options) {
    const { dc: dcInstance, vars: inputOpts } = validateArgs(
        connectorConfig,
        dcOrOptions,
        options,
    );
    function refFactory(vars) {
        return generateSummaryRef(dcInstance, vars);
    }
    return useDataConnectMutation(
        refFactory,
        inputOpts,
        CallerSdkTypeEnum.GeneratedReact,
    );
}
