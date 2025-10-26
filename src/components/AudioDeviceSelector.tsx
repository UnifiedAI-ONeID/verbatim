
import React from 'react';
import { Modal } from './Modal';

export const AudioDeviceSelector = ({ devices, onDeviceSelected, onClose, t }: any) => (
    <Modal onClose={onClose} title={t.selectAudioDeviceTitle}>
        <select onChange={e => onDeviceSelected(e.target.value)} defaultValue="">
            <option disabled value="">Select Device</option>
            {devices.map((d: any) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
    </Modal>
);
