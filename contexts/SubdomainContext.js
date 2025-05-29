import React, { createContext, useContext } from 'react';

const SubdomainContext = createContext();

export const useSubdomain = () => useContext(SubdomainContext);

export const SubdomainProvider = ({ children }) => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const subdomain = parts.length >= 3 ? parts[0] : null;

  return (
    <SubdomainContext.Provider value={{ subdomain }}>
      {children}
    </SubdomainContext.Provider>
  );
};
