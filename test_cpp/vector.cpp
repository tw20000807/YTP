#include<iostream>
#include<vector>
using namespace std;
int glo = 10;
int main(){
    vector< int > arr(10),arr2(10),arr3(10),arr4(10);
    for(int i = 0; i < 10; ++i) {
        arr[i] = i + 1;
    }
    for(int i = 0; i < 10; ++i) cout << arr[i] << " \n"[i == 9];

}