// Public server entry point; never import into browser components.
export {copilotStore,copilotMessage,protocolVersion,agentInstructions} from './index';
export {actionContext} from './context';
export {prepareAction,ownAction,confirmAction} from './actions';
export {copilotGuide} from './guide';
