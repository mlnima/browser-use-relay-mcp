import { createContext, useContext } from 'react';

export const LabContext = createContext(null);
export const useLab = () => useContext(LabContext);
