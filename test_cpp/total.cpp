#include<iostream>
#include<vector>
using namespace std;
int main(){
    int n = 10;
    vector< int > arr(n);
    vector< vector< int > > a(n);
    for(int i = 0; i < n; ++i){
        arr[i] =  - i;
        for(int j = 0; j < n; ++j){
            a[i].push_back(i * n + j);
        }
        
    }
}