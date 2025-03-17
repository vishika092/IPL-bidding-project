import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./component/Home";
import PrivateRoute from "./component/PrivateRoute";
import Login from "./component/Login";
import Alert from "./component/Alert";


function App() {
    let [alert, setAlert] = useState({type : "", message : ""})
    function showAlert({message, type}){
        setAlert({message , type})
        setTimeout(()=> {
          setAlert({message : "", type : ""})
        }, 3000)
      }

  return (
    <BrowserRouter>
       {alert.message && <Alert type={alert.type} message={alert.message} />}
      <Routes>
        <Route path="/" element={<PrivateRoute component={Home} showAlert={showAlert} />} />
        <Route path="/login" element={<Login  showAlert={showAlert}/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
