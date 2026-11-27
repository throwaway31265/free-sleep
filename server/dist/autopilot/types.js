export const DECISION_RING_SIZE = 200;
export const createDefaultRuntime = () => ({
    state: 'OFF',
    anchorF: null,
    anchorSource: null,
    anchorAt: null,
    nightRefC: null,
    nightKey: null,
    appliedOffset: 0,
    offsetIsVirtual: false,
    lastWrittenF: null,
    lastWriteAt: null,
    holdUntil: null,
    pausedUntil: null,
    failCount: 0,
    writesTonight: 0,
    lastHookAt: null,
    log: [],
});
//# sourceMappingURL=types.js.map