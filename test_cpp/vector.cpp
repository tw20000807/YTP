#include<iostream>
#include<vector>
using namespace std;
int glo = 10;
int main(){
    int arr[10] = {};
    int n = 3;
    for(int i = 0; i < 10; ++i) {
        arr[i] = i + 1;
    }
    for(int i = 0; i < 10; ++i) cout << arr[i] << " \n"[i == 9];

}