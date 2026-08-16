package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	loginReq2 := map[string]string{"identifier": "admin", "password": "admin123"}
	reqBody2, _ := json.Marshal(loginReq2)

	resp, err := http.Post("http://localhost:8080/api/v1/auth/login", "application/json", bytes.NewBuffer(reqBody2))
	if err != nil {
		fmt.Println("Error logging in:", err)
		return
	}
	defer resp.Body.Close()

	var loginRes map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&loginRes)
	
	if loginRes["success"] != true {
		fmt.Println("Login failed:", loginRes)
		return
	}
	
	data := loginRes["data"].(map[string]interface{})
	token := data["access_token"].(string)

	req, _ := http.NewRequest("GET", "http://localhost:8080/api/v1/admin/users?page=1&page_size=50", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	
	resp2, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("Error getting users:", err)
		return
	}
	defer resp2.Body.Close()

	body, _ := ioutil.ReadAll(resp2.Body)
	fmt.Println("Users Response:", string(body))
}
