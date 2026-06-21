import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatzApp from '../../apps/chatz/App';

export const BohAppsRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/chatz/*" element={<ChatzApp />} />
    </Routes>
  );
};

export default BohAppsRoutes;

